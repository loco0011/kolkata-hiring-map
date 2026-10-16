<?php

namespace App\Http\Controllers;

use App\Models\Area;
use App\Models\Company;
use App\Models\IngestRun;
use App\Models\JobPosting;
use App\Models\Submission;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    /** Postings older than this (since last confirmed live) get surfaced for a manual check. */
    private const ATTENTION_AFTER_DAYS = 14;

    public function dashboard(): Response
    {
        $attentionCutoff = now()->subDays(self::ATTENTION_AFTER_DAYS);

        $needsAttention = JobPosting::query()
            ->where('status', 'live')
            ->where(fn ($q) => $q->where('check_failures', '>', 0)->orWhere('last_seen_at', '<', $attentionCutoff))
            ->with('company:id,name,slug')
            ->orderBy('last_seen_at')
            ->get()
            ->map(fn (JobPosting $job) => [
                'id' => $job->id,
                'title' => $job->title,
                'company' => $job->company?->only(['name', 'slug']),
                'apply_url' => $job->apply_url,
                'check_failures' => $job->check_failures,
                'last_seen_days' => (int) $job->last_seen_at->diffInDays(now(), true),
                'last_checked_at' => $job->last_checked_at?->toIso8601String(),
                'hidden' => $job->last_seen_at->lt(now()->subDays(JobPosting::LIVE_WINDOW_DAYS)),
            ]);

        return Inertia::render('Dashboard', [
            'submissions' => Submission::query()
                ->where('status', 'pending')
                ->latest()
                ->limit(50)
                ->get(['id', 'kind', 'payload', 'created_at']),
            'stats' => [
                'pending' => Submission::where('status', 'pending')->count(),
                'companies' => Company::where('status', 'live')->count(),
                'livePostings' => JobPosting::live()->count(),
                'needsAttention' => $needsAttention->count(),
            ],
            'needsAttention' => $needsAttention,
            'lastCheckRun' => IngestRun::where('source', 'closure')->latest('started_at')->first(['started_at', 'finished_at', 'jobs_found', 'jobs_closed']),
            // ats_token is $hidden on the model (so public pages never get it); this admin-only
            // page needs it for the job sources form, so it's mapped explicitly.
            'companies' => Company::orderBy('name')->get(['id', 'name', 'careers_url', 'ats_provider', 'ats_token'])
                ->map(fn (Company $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'careers_url' => $c->careers_url,
                    'ats_provider' => $c->ats_provider,
                    'ats_token' => $c->ats_token,
                ]),
            'areas' => Area::orderBy('sort_order')->get(['key', 'label']),
            'options' => [
                'types' => Company::TYPES,
                'sectors' => Company::SECTORS,
                'expBuckets' => JobPosting::EXP_BUCKETS,
                'workModes' => JobPosting::WORK_MODES,
                'sources' => JobPosting::SOURCES,
                'atsProviders' => Company::ATS_PROVIDERS,
            ],
        ]);
    }

    public function reviewSubmission(Request $request, Submission $submission): RedirectResponse
    {
        $validated = $request->validate(['status' => ['required', 'in:approved,rejected']]);

        $this->markReviewed($submission, $validated['status'], $request);

        return back()->with('success', 'Submission '.$validated['status'].'.');
    }

    public function storeCompany(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'area' => ['required', 'exists:areas,key'],
            'address' => ['nullable', 'string', 'max:255'],
            'website' => ['nullable', 'url', 'max:255'],
            'type' => ['nullable', Rule::in(Company::TYPES)],
            'sector' => ['nullable', Rule::in(Company::SECTORS)],
            'lat' => ['nullable', 'numeric', 'between:22,23.2', 'required_with:lng'],
            'lng' => ['nullable', 'numeric', 'between:87.8,89', 'required_with:lat'],
            'is_verified' => ['boolean'],
            'submission_id' => ['nullable', 'exists:submissions,id'],
            ...$this->jobSourceRules(),
        ]);

        // Without exact coordinates, the pin goes at the area's centre.
        if (! isset($validated['lat'])) {
            $area = Area::find($validated['area']);
            $validated['lat'] = $area->lat;
            $validated['lng'] = $area->lng;
        }

        Company::create([
            ...collect($validated)->except('submission_id')->all(),
            'slug' => $this->uniqueSlug($validated['name']),
            'status' => 'live',
        ]);

        $this->approveLinkedSubmission($validated['submission_id'] ?? null, $request);

        return back()->with('success', "Added {$validated['name']}.");
    }

    /** Where the Python fetcher looks for this company's jobs. Blank fields clear the source. */
    public function updateJobSources(Request $request, Company $company): RedirectResponse
    {
        $company->update($request->validate($this->jobSourceRules()));

        return back()->with('success', "Job sources saved for {$company->name}.");
    }

    private function jobSourceRules(): array
    {
        return [
            'careers_url' => ['nullable', 'url', 'max:255'],
            'ats_provider' => ['nullable', 'required_with:ats_token', Rule::in(Company::ATS_PROVIDERS)],
            'ats_token' => [
                'nullable', 'required_with:ats_provider', 'string', 'max:100', 'regex:'.Company::ATS_TOKEN_PATTERN,
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (request('ats_provider') === 'zohorecruit' && ! preg_match(Company::ZOHO_HOST_PATTERN, (string) $value)) {
                        $fail('For Zoho Recruit, use the full careers host, e.g. acme.zohorecruit.in.');
                    }
                },
            ],
        ];
    }

    public function storePosting(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'company_id' => ['required', 'exists:companies,id'],
            'title' => ['required', 'string', 'max:255'],
            'exp_bucket' => ['nullable', Rule::in(JobPosting::EXP_BUCKETS)],
            'work_mode' => ['nullable', Rule::in(JobPosting::WORK_MODES)],
            'is_internship' => ['boolean'],
            'is_fresher_ok' => ['boolean'],
            'source' => ['required', Rule::in(JobPosting::SOURCES)],
            'source_label' => ['nullable', 'string', 'max:100'],
            'apply_url' => ['required', 'url', 'max:2048'],
            'pay_min' => ['nullable', 'integer', 'min:0'],
            'pay_max' => ['nullable', 'integer', 'min:0', 'gte:pay_min'],
            'pay_period' => ['nullable', 'required_with:pay_min,pay_max', 'in:annual,monthly'],
            'posted_at' => ['nullable', 'date', 'before_or_equal:today'],
            'submission_id' => ['nullable', 'exists:submissions,id'],
        ]);

        $titleNorm = JobPosting::normalizeTitle($validated['title']);

        $duplicate = JobPosting::where('company_id', $validated['company_id'])
            ->where('title_norm', $titleNorm)
            ->where('exp_bucket', $validated['exp_bucket'] ?? null)
            ->exists();

        if ($duplicate) {
            return back()->withErrors(['title' => 'This company already has a posting with this title and experience level.']);
        }

        JobPosting::create([
            ...collect($validated)->except('submission_id')->all(),
            'title_norm' => $titleNorm,
            'pay_is_disclosed' => isset($validated['pay_min']) || isset($validated['pay_max']),
            'first_seen_at' => now(),
            'last_seen_at' => now(),
            'status' => 'live',
        ]);

        $this->approveLinkedSubmission($validated['submission_id'] ?? null, $request);

        return back()->with('success', "Added {$validated['title']}.");
    }

    public function confirmPosting(JobPosting $posting): RedirectResponse
    {
        $posting->update(['last_seen_at' => now(), 'check_failures' => 0]);

        return back()->with('success', 'Marked as still live.');
    }

    public function closePosting(JobPosting $posting): RedirectResponse
    {
        $posting->update(['status' => 'closed', 'closed_at' => now()]);

        return back()->with('success', 'Posting closed.');
    }

    private function approveLinkedSubmission(?string $submissionId, Request $request): void
    {
        if ($submissionId && ($submission = Submission::find($submissionId))) {
            $this->markReviewed($submission, 'approved', $request);
        }
    }

    private function markReviewed(Submission $submission, string $status, Request $request): void
    {
        $submission->update([
            'status' => $status,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'company';
        $slug = $base;

        for ($i = 2; Company::where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
