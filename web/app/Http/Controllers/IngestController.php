<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\IngestRun;
use App\Models\JobPosting;
use App\Models\Submission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The API the Python fetcher service (fetcher/) talks to.
 *
 * Laravel stays the owner of all data: the fetcher never writes postings
 * directly. Newly found jobs become pending submissions on /dashboard, and a
 * job already on the map that the fetcher sees again just has its
 * last_seen_at refreshed — being on the company's own job board right now is
 * a stronger "still live" signal than the link check.
 */
class IngestController extends Controller
{
    /** ingest_runs.source values the fetcher can report (everything except 'closure'). */
    private const FETCH_SOURCES = [...Company::ATS_PROVIDERS, 'jsonld', 'llm'];

    /** Companies the fetcher should scan: an ATS board, or a careers page to read JobPosting data from. */
    public function companies(): JsonResponse
    {
        $companies = Company::query()
            ->where('status', 'live')
            ->where(fn ($q) => $q->whereNotNull('careers_url')
                ->orWhere(fn ($q) => $q->whereNotNull('ats_provider')->whereNotNull('ats_token')))
            ->orderBy('name')
            ->get()
            ->map(fn (Company $c) => [
                'slug' => $c->slug,
                'name' => $c->name,
                'website' => $c->website,
                'careers_url' => $c->careers_url,
                'ats_provider' => $c->ats_provider,
                'ats_token' => $c->ats_token,
            ]);

        return response()->json(['companies' => $companies]);
    }

    public function jobs(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['required', Rule::in(self::FETCH_SOURCES)],
            'companies_scanned' => ['nullable', 'integer', 'min:0'],
            'errors' => ['nullable', 'array', 'max:500'],
            'jobs' => ['present', 'array', 'max:2000'],
            'jobs.*.company_slug' => ['required', 'string', 'max:255'],
            'jobs.*.title' => ['required', 'string', 'max:255'],
            'jobs.*.apply_url' => ['required', 'url', 'max:2048'],
            'jobs.*.location' => ['nullable', 'string', 'max:255'],
            'jobs.*.department' => ['nullable', 'string', 'max:255'],
            'jobs.*.exp_bucket' => ['nullable', Rule::in(JobPosting::EXP_BUCKETS)],
            'jobs.*.work_mode' => ['nullable', Rule::in(JobPosting::WORK_MODES)],
            'jobs.*.posted_at' => ['nullable', 'date'],
        ]);

        $run = IngestRun::create([
            'source' => $validated['source'],
            'started_at' => now(),
            'companies_scanned' => $validated['companies_scanned'] ?? 0,
        ]);

        $companies = Company::whereIn('slug', collect($validated['jobs'])->pluck('company_slug')->unique())
            ->get()
            ->keyBy('slug');

        $counts = ['queued' => 0, 'refreshed' => 0, 'skipped' => 0, 'unknown_company' => 0];
        $results = [];

        foreach ($validated['jobs'] as $i => $job) {
            $outcome = $this->ingestJob($job, $companies->get($job['company_slug']), $validated['source']);
            $counts[$outcome]++;
            $results[] = ['index' => $i, 'outcome' => $outcome];
        }

        $run->update([
            'finished_at' => now(),
            'jobs_found' => count($validated['jobs']),
            'jobs_new' => $counts['queued'],
            'errors' => $validated['errors'] ?? null,
        ]);

        return response()->json(['run_id' => $run->id, 'counts' => $counts, 'results' => $results]);
    }

    /** Every live posting, for the fetcher's nightly link check. */
    public function postings(): JsonResponse
    {
        return response()->json([
            'postings' => JobPosting::where('status', 'live')->orderBy('last_checked_at')->get(['id', 'title', 'apply_url']),
        ]);
    }

    /** Results of the fetcher's link check, applied with the same rules as `postings:check`. */
    public function checks(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'results' => ['present', 'array', 'max:10000'],
            'results.*.id' => ['required', 'string'],
            'results.*.result' => ['required', 'in:alive,dead,unknown'],
            'results.*.reason' => ['nullable', 'string', 'max:255'],
        ]);

        $run = IngestRun::create(['source' => 'closure', 'started_at' => now()]);

        $postings = JobPosting::where('status', 'live')
            ->whereIn('id', collect($validated['results'])->pluck('id'))
            ->get()
            ->keyBy('id');

        $counts = ['alive' => 0, 'dead' => 0, 'unknown' => 0, 'closed' => 0, 'ignored' => 0];
        $errors = [];

        foreach ($validated['results'] as $check) {
            $posting = $postings->get($check['id']);
            if (! $posting) {
                // closed or deleted since the fetcher fetched the list
                $counts['ignored']++;

                continue;
            }

            $counts[$check['result']]++;
            if ($posting->recordCheck($check['result'])) {
                $counts['closed']++;
            }

            if ($check['result'] !== 'alive') {
                $errors[] = ['posting' => $posting->id, 'url' => $posting->apply_url, 'result' => $check['result'], 'reason' => $check['reason'] ?? null];
            }
        }

        $run->update([
            'finished_at' => now(),
            'jobs_found' => $postings->count(),
            'jobs_closed' => $counts['closed'],
            'errors' => $errors ?: null,
        ]);

        return response()->json(['run_id' => $run->id, 'counts' => $counts]);
    }

    /** @return 'queued'|'refreshed'|'skipped'|'unknown_company' */
    private function ingestJob(array $job, ?Company $company, string $source): string
    {
        if (! $company) {
            return 'unknown_company';
        }

        $existing = JobPosting::where('company_id', $company->id)
            ->where(fn ($q) => $q->where('title_norm', JobPosting::normalizeTitle($job['title']))
                ->orWhere('apply_url', $job['apply_url']))
            ->first();

        if ($existing) {
            if ($existing->status !== 'live') {
                return 'skipped';
            }
            $existing->update(['last_seen_at' => now(), 'check_failures' => 0]);

            return 'refreshed';
        }

        // Already waiting in the queue, or a moderator approved/rejected it before —
        // never re-queue something a person has already looked at.
        if (Submission::where('kind', 'job')->where('payload->source_url', $job['apply_url'])->exists()) {
            return 'skipped';
        }

        Submission::create([
            'kind' => 'job',
            'status' => 'pending',
            'payload' => [
                'company_name' => $company->name,
                'role' => $job['title'],
                'experience' => $job['exp_bucket'] ?? null,
                'pay' => null,
                'source_url' => $job['apply_url'],
                'origin' => 'fetcher',
                'provider' => $source,
                'location' => $job['location'] ?? null,
                'department' => $job['department'] ?? null,
                'work_mode' => $job['work_mode'] ?? null,
                'posted_at' => $job['posted_at'] ?? null,
            ],
        ]);

        return 'queued';
    }
}
