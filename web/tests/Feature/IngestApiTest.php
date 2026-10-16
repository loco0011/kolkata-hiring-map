<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\IngestRun;
use App\Models\JobPosting;
use App\Models\Submission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IngestApiTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-ingest-token';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.ingest.token' => self::TOKEN]);
    }

    private function api(): static
    {
        return $this->withToken(self::TOKEN)->withHeader('Accept', 'application/json');
    }

    private function job(Company $company, array $overrides = []): array
    {
        return [
            'company_slug' => $company->slug,
            'title' => 'Backend Engineer',
            'apply_url' => 'https://boards.greenhouse.io/acme/jobs/1',
            'location' => 'Kolkata, India',
            ...$overrides,
        ];
    }

    public function test_requests_without_the_right_token_are_rejected(): void
    {
        $this->getJson('/api/ingest/companies')->assertUnauthorized();
        $this->withToken('wrong')->getJson('/api/ingest/companies')->assertUnauthorized();
    }

    public function test_api_is_off_when_no_token_is_configured(): void
    {
        config(['services.ingest.token' => null]);

        $this->withToken('')->getJson('/api/ingest/companies')->assertStatus(503);
    }

    public function test_companies_lists_only_scannable_live_companies_with_their_ats_token(): void
    {
        Company::factory()->create(['slug' => 'acme', 'ats_provider' => 'greenhouse', 'ats_token' => 'acme']);
        Company::factory()->create(['slug' => 'careers-only', 'careers_url' => 'https://example.com/careers']);
        Company::factory()->create(['slug' => 'nothing-to-scan', 'careers_url' => null, 'ats_provider' => null]);
        Company::factory()->create(['slug' => 'hidden', 'status' => 'hidden', 'careers_url' => 'https://example.com/careers']);

        $response = $this->api()->getJson('/api/ingest/companies')->assertOk();

        $slugs = collect($response->json('companies'))->pluck('slug')->sort()->values()->all();
        $this->assertSame(['acme', 'careers-only'], $slugs);
        $this->assertSame('acme', collect($response->json('companies'))->firstWhere('slug', 'acme')['ats_token']);
    }

    public function test_new_job_is_queued_as_a_pending_submission(): void
    {
        $company = Company::factory()->create();

        $this->api()->postJson('/api/ingest/jobs', [
            'source' => 'greenhouse',
            'companies_scanned' => 1,
            'jobs' => [$this->job($company, ['exp_bucket' => 'Fresher', 'work_mode' => 'hybrid'])],
        ])->assertOk()->assertJsonPath('counts.queued', 1);

        $submission = Submission::sole();
        $this->assertSame('pending', $submission->status);
        $this->assertSame('job', $submission->kind);
        $this->assertSame($company->name, $submission->payload['company_name']);
        $this->assertSame('Backend Engineer', $submission->payload['role']);
        $this->assertSame('fetcher', $submission->payload['origin']);
        $this->assertSame('Fresher', $submission->payload['experience']);
        $this->assertSame(0, JobPosting::count(), 'fetched jobs never go straight onto the map');

        $run = IngestRun::sole();
        $this->assertSame('greenhouse', $run->source);
        $this->assertSame(1, $run->jobs_new);
        $this->assertNotNull($run->finished_at);
    }

    public function test_runs_from_the_indian_job_boards_are_recorded(): void
    {
        $company = Company::factory()->create();

        foreach (['freshteam', 'darwinbox', 'keka', 'zohorecruit'] as $i => $source) {
            $this->api()->postJson('/api/ingest/jobs', [
                'source' => $source,
                'jobs' => [$this->job($company, ['title' => "Role {$i}", 'apply_url' => "https://example.com/{$source}"])],
            ])->assertOk()->assertJsonPath('counts.queued', 1);
        }

        $this->assertSame(['darwinbox', 'freshteam', 'keka', 'zohorecruit'], IngestRun::orderBy('source')->pluck('source')->all());
    }

    public function test_same_job_is_not_queued_twice_or_after_rejection(): void
    {
        $company = Company::factory()->create();
        $payload = ['source' => 'lever', 'jobs' => [$this->job($company)]];

        $this->api()->postJson('/api/ingest/jobs', $payload)->assertJsonPath('counts.queued', 1);
        $this->api()->postJson('/api/ingest/jobs', $payload)->assertJsonPath('counts.skipped', 1);

        Submission::query()->update(['status' => 'rejected']);
        $this->api()->postJson('/api/ingest/jobs', $payload)->assertJsonPath('counts.skipped', 1);

        $this->assertSame(1, Submission::count());
    }

    public function test_job_already_on_the_map_is_refreshed_not_queued(): void
    {
        $posting = JobPosting::factory()->create([
            'title' => 'Backend Engineer!',
            'title_norm' => JobPosting::normalizeTitle('Backend Engineer!'),
            'last_seen_at' => now()->subDays(12),
            'check_failures' => 1,
        ]);

        $this->api()->postJson('/api/ingest/jobs', [
            'source' => 'greenhouse',
            'jobs' => [$this->job($posting->company)],
        ])->assertJsonPath('counts.refreshed', 1);

        $posting->refresh();
        $this->assertTrue($posting->last_seen_at->isToday());
        $this->assertSame(0, $posting->check_failures);
        $this->assertSame(0, Submission::count());
    }

    public function test_closed_posting_is_not_revived_or_requeued(): void
    {
        $posting = JobPosting::factory()->create([
            'apply_url' => 'https://boards.greenhouse.io/acme/jobs/1',
            'status' => 'closed',
        ]);

        $this->api()->postJson('/api/ingest/jobs', [
            'source' => 'greenhouse',
            'jobs' => [$this->job($posting->company, ['title' => 'Different title'])],
        ])->assertJsonPath('counts.skipped', 1);

        $this->assertSame('closed', $posting->fresh()->status);
        $this->assertSame(0, Submission::count());
    }

    public function test_jobs_for_unknown_companies_are_reported_not_stored(): void
    {
        $this->api()->postJson('/api/ingest/jobs', [
            'source' => 'ashby',
            'jobs' => [['company_slug' => 'nope', 'title' => 'X', 'apply_url' => 'https://example.com/x']],
        ])->assertOk()->assertJsonPath('results.0.outcome', 'unknown_company');

        $this->assertSame(0, Submission::count());
    }

    public function test_invalid_job_payload_is_rejected(): void
    {
        $this->api()->postJson('/api/ingest/jobs', [
            'source' => 'closure',
            'jobs' => [['company_slug' => 'x', 'title' => 'X', 'apply_url' => 'not a url']],
        ])->assertStatus(422)->assertJsonValidationErrors(['source', 'jobs.0.apply_url']);
    }

    public function test_postings_lists_live_postings_for_the_link_check(): void
    {
        $live = JobPosting::factory()->create();
        JobPosting::factory()->create(['status' => 'closed']);

        $this->api()->getJson('/api/ingest/postings')
            ->assertOk()
            ->assertJsonCount(1, 'postings')
            ->assertJsonPath('postings.0.id', $live->id);
    }

    public function test_check_results_apply_the_same_strike_rules_as_postings_check(): void
    {
        $alive = JobPosting::factory()->create(['last_seen_at' => now()->subDays(10), 'check_failures' => 1]);
        $dying = JobPosting::factory()->create(['check_failures' => 1]);
        $unsure = JobPosting::factory()->create(['last_seen_at' => now()->subDays(5)]);

        $this->api()->postJson('/api/ingest/checks', ['results' => [
            ['id' => $alive->id, 'result' => 'alive', 'reason' => 'HTTP 200'],
            ['id' => $dying->id, 'result' => 'dead', 'reason' => 'HTTP 404'],
            ['id' => $unsure->id, 'result' => 'unknown', 'reason' => 'HTTP 403'],
            ['id' => 'does-not-exist', 'result' => 'dead'],
        ]])->assertOk()
            ->assertJsonPath('counts.closed', 1)
            ->assertJsonPath('counts.ignored', 1);

        $this->assertTrue($alive->fresh()->last_seen_at->isToday());
        $this->assertSame(0, $alive->fresh()->check_failures);
        $this->assertSame('closed', $dying->fresh()->status);
        $this->assertFalse($unsure->fresh()->last_seen_at->isToday());
        $this->assertNotNull($unsure->fresh()->last_checked_at);

        $run = IngestRun::sole();
        $this->assertSame('closure', $run->source);
        $this->assertSame(3, $run->jobs_found);
        $this->assertSame(1, $run->jobs_closed);
    }
}
