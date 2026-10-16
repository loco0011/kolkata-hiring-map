<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\Company;
use App\Models\JobPosting;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => true])->save();

        return $user;
    }

    private function area(): Area
    {
        return Area::create([
            'key' => 'test-area', 'label' => 'Test Area', 'lat' => 22.5, 'lng' => 88.4, 'default_zoom' => 14, 'sort_order' => 1,
        ]);
    }

    public function test_guests_are_sent_to_login(): void
    {
        $this->get('/dashboard')->assertRedirect(route('login'));
    }

    public function test_non_admins_are_forbidden(): void
    {
        $this->actingAs(User::factory()->create())->get('/dashboard')->assertForbidden();
        $this->actingAs(User::factory()->create())->post('/admin/companies', [])->assertForbidden();
    }

    public function test_admin_can_view_dashboard(): void
    {
        Submission::create(['kind' => 'company', 'payload' => ['company_name' => 'X', 'source_url' => 'https://x.test'], 'status' => 'pending']);

        $this->actingAs($this->admin())
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Dashboard')->has('submissions', 1)->where('stats.pending', 1));
    }

    public function test_seeder_creates_an_admin_without_the_default_password(): void
    {
        $this->seed(\Database\Seeders\DatabaseSeeder::class);

        $admin = User::where('email', env('ADMIN_EMAIL', 'admin@kolkatahiringmap.com'))->sole();
        $this->assertTrue($admin->is_admin);
        $this->assertFalse(\Illuminate\Support\Facades\Hash::check('password', $admin->password));
    }

    public function test_is_admin_cannot_be_mass_assigned(): void
    {
        $user = User::factory()->create();
        $user->update(['is_admin' => true]);

        $this->assertFalse($user->fresh()->is_admin);
    }

    public function test_admin_can_reject_a_submission(): void
    {
        $admin = $this->admin();
        $submission = Submission::create(['kind' => 'company', 'payload' => ['company_name' => 'X'], 'status' => 'pending']);

        $this->actingAs($admin)->patch("/admin/submissions/{$submission->id}", ['status' => 'rejected'])->assertRedirect();

        $submission->refresh();
        $this->assertSame('rejected', $submission->status);
        $this->assertSame($admin->id, $submission->reviewed_by);
    }

    public function test_adding_a_company_defaults_to_area_centre_and_approves_the_submission(): void
    {
        $area = $this->area();
        $submission = Submission::create(['kind' => 'company', 'payload' => ['company_name' => 'Acme'], 'status' => 'pending']);

        $this->actingAs($this->admin())->post('/admin/companies', [
            'name' => 'Acme Labs',
            'area' => $area->key,
            'is_verified' => true,
            'submission_id' => $submission->id,
        ])->assertSessionHasNoErrors();

        $company = Company::where('name', 'Acme Labs')->sole();
        $this->assertSame('acme-labs', $company->slug);
        $this->assertEquals(22.5, (float) $company->lat);
        $this->assertSame('approved', $submission->fresh()->status);
    }

    public function test_company_slugs_stay_unique(): void
    {
        $area = $this->area();
        Company::factory()->create(['slug' => 'acme']);

        $this->actingAs($this->admin())->post('/admin/companies', ['name' => 'Acme', 'area' => $area->key]);

        $this->assertTrue(Company::where('slug', 'acme-2')->exists());
    }

    public function test_admin_can_add_a_posting_and_it_goes_live(): void
    {
        $company = Company::factory()->create();

        $this->actingAs($this->admin())->post('/admin/postings', [
            'company_id' => $company->id,
            'title' => 'Backend Intern',
            'exp_bucket' => 'Intern',
            'is_internship' => true,
            'source' => 'careers',
            'apply_url' => 'https://example.com/jobs/1',
            'pay_min' => 15000,
            'pay_period' => 'monthly',
        ])->assertSessionHasNoErrors();

        $job = JobPosting::sole();
        $this->assertSame('backend intern', $job->title_norm);
        $this->assertTrue($job->pay_is_disclosed);
        $this->assertSame(1, JobPosting::live()->count());
    }

    public function test_duplicate_posting_is_rejected_with_a_validation_error(): void
    {
        $job = JobPosting::factory()->create(['title' => 'Java Dev', 'title_norm' => 'java dev', 'exp_bucket' => 'Fresher']);

        $this->actingAs($this->admin())->post('/admin/postings', [
            'company_id' => $job->company_id,
            'title' => 'Java Dev',
            'exp_bucket' => 'Fresher',
            'source' => 'careers',
            'apply_url' => 'https://example.com/jobs/2',
        ])->assertSessionHasErrors('title');

        $this->assertSame(1, JobPosting::count());
    }

    public function test_confirm_and_close_posting(): void
    {
        $admin = $this->admin();
        $job = JobPosting::factory()->create(['last_seen_at' => now()->subDays(30), 'check_failures' => 1]);

        $this->actingAs($admin)->patch("/admin/postings/{$job->id}/confirm");
        $job->refresh();
        $this->assertTrue($job->last_seen_at->isToday());
        $this->assertSame(0, $job->check_failures);

        $this->actingAs($admin)->patch("/admin/postings/{$job->id}/close");
        $this->assertSame('closed', $job->fresh()->status);
    }

    public function test_adding_a_company_can_set_its_job_sources(): void
    {
        $area = $this->area();

        $this->actingAs($this->admin())->post('/admin/companies', [
            'name' => 'Acme Labs',
            'area' => $area->key,
            'careers_url' => 'https://acme.example/careers',
            'ats_provider' => 'lever',
            'ats_token' => 'acme-labs',
        ])->assertSessionHasNoErrors();

        $company = Company::where('name', 'Acme Labs')->sole();
        $this->assertSame('lever', $company->ats_provider);
        $this->assertSame('acme-labs', $company->ats_token);
        $this->assertSame('https://acme.example/careers', $company->careers_url);
    }

    public function test_admin_can_update_and_clear_job_sources(): void
    {
        $admin = $this->admin();
        $company = Company::factory()->create();

        $this->actingAs($admin)->patch("/admin/companies/{$company->id}/sources", [
            'ats_provider' => 'greenhouse',
            'ats_token' => 'acme',
            'careers_url' => 'https://acme.example/careers',
        ])->assertSessionHasNoErrors()->assertSessionHas('success');

        $company->refresh();
        $this->assertSame(['greenhouse', 'acme', 'https://acme.example/careers'], [$company->ats_provider, $company->ats_token, $company->careers_url]);

        $this->actingAs($admin)->patch("/admin/companies/{$company->id}/sources", [
            'ats_provider' => '',
            'ats_token' => '',
            'careers_url' => '',
        ])->assertSessionHasNoErrors();

        $company->refresh();
        $this->assertNull($company->ats_provider);
        $this->assertNull($company->ats_token);
        $this->assertNull($company->careers_url);
    }

    public function test_job_source_validation(): void
    {
        $admin = $this->admin();
        $company = Company::factory()->create();
        $url = "/admin/companies/{$company->id}/sources";

        $this->actingAs($admin)->patch($url, ['ats_provider' => 'greenhouse'])->assertSessionHasErrors('ats_token');
        $this->actingAs($admin)->patch($url, ['ats_token' => 'acme'])->assertSessionHasErrors('ats_provider');
        $this->actingAs($admin)->patch($url, ['ats_provider' => 'naukri', 'ats_token' => 'acme'])->assertSessionHasErrors('ats_provider');
        $this->actingAs($admin)->patch($url, ['careers_url' => 'not a url'])->assertSessionHasErrors('careers_url');

        // tokens end up in API URLs (recruitee: as a subdomain), so only plain slugs
        foreach (['evil.com/x', 'a b', '../x', 'x?y=1', '@host'] as $bad) {
            $this->actingAs($admin)->patch($url, ['ats_provider' => 'recruitee', 'ats_token' => $bad])->assertSessionHasErrors('ats_token');
        }
        $this->assertNull($company->fresh()->ats_token);
    }

    public function test_indian_job_boards_are_accepted_and_zoho_needs_the_full_host(): void
    {
        $admin = $this->admin();
        $company = Company::factory()->create();
        $url = "/admin/companies/{$company->id}/sources";

        foreach (['freshteam' => 'indusnet', 'darwinbox' => 'birlacorp', 'keka' => 'mihup', 'zohorecruit' => 'acme.zohorecruit.in'] as $provider => $token) {
            $this->actingAs($admin)->patch($url, ['ats_provider' => $provider, 'ats_token' => $token])->assertSessionHasNoErrors();
            $this->assertSame($provider, $company->fresh()->ats_provider);
        }

        foreach (['acme', 'acme.zohorecruit.in.evil.com', 'acme.zohorecruit.xyz'] as $bad) {
            $this->actingAs($admin)->patch($url, ['ats_provider' => 'zohorecruit', 'ats_token' => $bad])->assertSessionHasErrors('ats_token');
        }
    }

    public function test_non_admins_cannot_change_job_sources(): void
    {
        $company = Company::factory()->create();

        $this->actingAs(User::factory()->create())
            ->patch("/admin/companies/{$company->id}/sources", ['ats_provider' => 'lever', 'ats_token' => 'x'])
            ->assertForbidden();
        $this->assertNull($company->fresh()->ats_provider);
    }

    public function test_dashboard_gives_admins_the_job_sources(): void
    {
        Company::factory()->create(['name' => 'Acme', 'ats_provider' => 'ashby', 'ats_token' => 'acme']);

        $this->actingAs($this->admin())
            ->get('/dashboard')
            ->assertInertia(fn ($page) => $page
                ->where('companies.0.ats_provider', 'ashby')
                ->where('companies.0.ats_token', 'acme')
                ->where('options.atsProviders', Company::ATS_PROVIDERS));
    }
}
