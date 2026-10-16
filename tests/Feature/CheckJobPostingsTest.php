<?php

namespace Tests\Feature;

use App\Models\IngestRun;
use App\Models\JobPosting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;
use Tests\TestCase;

class CheckJobPostingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sleep::fake();
    }

    public function test_alive_link_refreshes_last_seen_and_resets_strikes(): void
    {
        Http::fake(['*' => Http::response('<h1>Apply now</h1>', 200)]);
        $job = JobPosting::factory()->create([
            'apply_url' => 'https://example.com/job/1',
            'last_seen_at' => now()->subDays(10),
            'check_failures' => 1,
        ]);

        $this->artisan('postings:check')->assertSuccessful();

        $job->refresh();
        $this->assertTrue($job->last_seen_at->isToday());
        $this->assertSame(0, $job->check_failures);
        $this->assertSame('live', $job->status);
        $this->assertNotNull($job->last_checked_at);
    }

    public function test_one_404_is_a_strike_and_a_second_closes_the_posting(): void
    {
        Http::fake(['*' => Http::response('', 404)]);
        $job = JobPosting::factory()->create(['apply_url' => 'https://example.com/job/gone']);

        $this->artisan('postings:check')->assertSuccessful();
        $job->refresh();
        $this->assertSame(1, $job->check_failures);
        $this->assertSame('live', $job->status);

        $this->artisan('postings:check')->assertSuccessful();
        $job->refresh();
        $this->assertSame('closed', $job->status);
        $this->assertNotNull($job->closed_at);
    }

    public function test_expired_page_text_counts_as_dead(): void
    {
        Http::fake(['*' => Http::response('<p>This job is no longer accepting applications.</p>', 200)]);
        $job = JobPosting::factory()->create(['check_failures' => 1]);

        $this->artisan('postings:check')->assertSuccessful();

        $this->assertSame('closed', $job->fresh()->status);
    }

    public function test_bot_wall_or_server_error_changes_nothing(): void
    {
        Http::fake(['*' => Http::response('', 403)]);
        $lastSeen = now()->subDays(5)->startOfSecond();
        $job = JobPosting::factory()->create(['last_seen_at' => $lastSeen]);

        $this->artisan('postings:check')->assertSuccessful();

        $job->refresh();
        $this->assertSame(0, $job->check_failures);
        $this->assertSame('live', $job->status);
        $this->assertTrue($job->last_seen_at->eq($lastSeen));
    }

    public function test_run_is_logged(): void
    {
        Http::fake(['*' => Http::response('', 404)]);
        JobPosting::factory()->count(2)->create();

        $this->artisan('postings:check')->assertSuccessful();

        $run = IngestRun::where('source', 'closure')->sole();
        $this->assertSame(2, $run->jobs_found);
        $this->assertNotNull($run->finished_at);
    }

    public function test_closed_postings_are_not_rechecked(): void
    {
        Http::fake();
        JobPosting::factory()->create(['status' => 'closed']);

        $this->artisan('postings:check')->assertSuccessful();

        Http::assertNothingSent();
    }
}
