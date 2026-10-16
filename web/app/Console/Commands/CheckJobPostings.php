<?php

namespace App\Console\Commands;

use App\Models\IngestRun;
use App\Models\JobPosting;
use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;
use Illuminate\Support\Str;
use Throwable;

/**
 * Re-checks every live posting's apply_url.
 *
 *  - alive   → last_seen_at is refreshed, so the posting stays on the site
 *  - dead    → one strike; two consecutive strikes close the posting
 *  - unknown → nothing changes (bot walls, timeouts, 5xx); if a posting stays
 *              unknown it ages out of the live window and shows up on the
 *              dashboard's "needs attention" list for a manual check
 *
 * Note: for postings whose apply_url is a general careers page rather than a
 * specific job page, "alive" only proves the page is still up — not that the
 * particular role is still open. The dashboard lets an admin close those.
 */
class CheckJobPostings extends Command
{
    protected $signature = 'postings:check {--delay=500 : Milliseconds to wait between requests}';

    protected $description = 'Re-check live job postings and close ones whose links have gone dead';

    public const STRIKES_TO_CLOSE = JobPosting::STRIKES_TO_CLOSE;

    /** Phrases job boards show on an expired posting that still returns HTTP 200. */
    private const DEAD_PHRASES = [
        'no longer accepting applications',
        'this job is no longer available',
        'job has expired',
        'this job has been closed',
        'position has been filled',
        'this position is closed',
        'job is closed',
        'job not found',
        'vacancy has expired',
    ];

    public function handle(): int
    {
        $run = IngestRun::create(['source' => 'closure', 'started_at' => now()]);

        $counts = ['alive' => 0, 'dead' => 0, 'unknown' => 0, 'closed' => 0];
        $errors = [];

        $postings = JobPosting::query()->where('status', 'live')->get();

        foreach ($postings as $i => $posting) {
            if ($i > 0) {
                Sleep::for((int) $this->option('delay'))->milliseconds();
            }

            [$result, $reason] = $this->probe($posting->apply_url);
            $counts[$result]++;

            if ($posting->recordCheck($result)) {
                $counts['closed']++;
            }

            if ($result !== 'alive') {
                $errors[] = ['posting' => $posting->id, 'url' => $posting->apply_url, 'result' => $result, 'reason' => $reason];
            }

            $this->line(sprintf('%-7s %s  (%s)', strtoupper($result), Str::limit($posting->title, 50), $reason));
        }

        $run->update([
            'finished_at' => now(),
            'jobs_found' => $postings->count(),
            'jobs_closed' => $counts['closed'],
            'errors' => $errors ?: null,
        ]);

        $this->newLine();
        $this->table(['Checked', 'Alive', 'Dead strike', 'Unknown', 'Closed'], [[
            $postings->count(), $counts['alive'], $counts['dead'], $counts['unknown'], $counts['closed'],
        ]]);

        return self::SUCCESS;
    }

    /**
     * @return array{0: 'alive'|'dead'|'unknown', 1: string}
     */
    private function probe(string $url): array
    {
        try {
            $response = Http::timeout(20)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (compatible; KolkataHiringMapLinkCheck/1.0; +'.config('app.url').')',
                    'Accept' => 'text/html,application/xhtml+xml',
                ])
                ->get($url);
        } catch (ConnectionException $e) {
            return ['unknown', 'connection failed'];
        } catch (Throwable $e) {
            return ['unknown', class_basename($e)];
        }

        $status = $response->status();

        if (in_array($status, [404, 410], true)) {
            return ['dead', "HTTP {$status}"];
        }

        if (! $response->successful()) {
            // 403/429/999 are usually bot walls (LinkedIn, Cloudflare), 5xx is a
            // server hiccup — neither says anything about the posting itself.
            return ['unknown', "HTTP {$status}"];
        }

        $body = Str::lower(strip_tags($response->body()));
        foreach (self::DEAD_PHRASES as $phrase) {
            if (str_contains($body, $phrase)) {
                return ['dead', "page says \"{$phrase}\""];
            }
        }

        return ['alive', "HTTP {$status}"];
    }
}
