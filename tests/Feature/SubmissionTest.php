<?php

namespace Tests\Feature;

use App\Models\Submission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubmissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_valid_submission_is_stored_as_pending(): void
    {
        $response = $this->post('/submit', [
            'kind' => 'company',
            'company_name' => 'Test Co',
            'source_url' => 'https://example.com/careers',
        ]);

        $response->assertRedirect(route('submit'));
        $this->assertDatabaseCount('submissions', 1);
        $this->assertSame('pending', Submission::first()->status);
    }

    public function test_missing_required_fields_fail_validation(): void
    {
        $response = $this->post('/submit', ['kind' => 'company']);

        $response->assertSessionHasErrors(['company_name', 'source_url']);
        $this->assertDatabaseCount('submissions', 0);
    }

    public function test_job_submission_requires_a_role(): void
    {
        $response = $this->post('/submit', [
            'kind' => 'job',
            'company_name' => 'Test Co',
            'source_url' => 'https://example.com/careers',
        ]);

        $response->assertSessionHasErrors(['role']);
        $this->assertDatabaseCount('submissions', 0);
    }

    public function test_invalid_source_url_fails_validation(): void
    {
        $response = $this->post('/submit', [
            'kind' => 'company',
            'company_name' => 'Test Co',
            'source_url' => 'not-a-url',
        ]);

        $response->assertSessionHasErrors(['source_url']);
        $this->assertDatabaseCount('submissions', 0);
    }

    public function test_honeypot_field_silently_drops_submission(): void
    {
        $response = $this->post('/submit', [
            'kind' => 'company',
            'company_name' => 'Bot Co',
            'source_url' => 'https://example.com/careers',
            'website' => 'https://spam.example.com',
        ]);

        // Looks like success to the bot, but nothing was actually stored.
        $response->assertRedirect(route('submit'));
        $this->assertDatabaseCount('submissions', 0);
    }

    public function test_email_is_hashed_not_stored_in_plaintext(): void
    {
        $this->post('/submit', [
            'kind' => 'company',
            'company_name' => 'Test Co',
            'source_url' => 'https://example.com/careers',
            'email' => 'person@example.com',
        ]);

        $submission = Submission::first();
        $this->assertNotNull($submission->submitter_email_hash);
        $this->assertStringNotContainsString('person@example.com', $submission->submitter_email_hash);
    }

    public function test_submit_endpoint_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->post('/submit', [
                'kind' => 'company',
                'company_name' => "Co {$i}",
                'source_url' => 'https://example.com/careers',
            ])->assertRedirect(route('submit'));
        }

        $this->post('/submit', [
            'kind' => 'company',
            'company_name' => 'One Too Many',
            'source_url' => 'https://example.com/careers',
        ])->assertStatus(429);
    }
}
