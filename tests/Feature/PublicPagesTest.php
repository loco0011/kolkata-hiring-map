<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\Company;
use App\Models\JobPosting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PublicPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_map_page_loads(): void
    {
        $this->get('/')->assertStatus(200);
    }

    public function test_openings_page_loads(): void
    {
        $this->get('/openings')->assertStatus(200);
    }

    public function test_about_page_loads(): void
    {
        $this->get('/about')->assertStatus(200);
    }

    public function test_sitemap_loads(): void
    {
        $this->get('/sitemap.xml')->assertStatus(200);
    }

    public function test_company_show_page_loads_for_live_company(): void
    {
        $company = Company::factory()->create();
        JobPosting::factory()->create(['company_id' => $company->id]);

        $this->get("/company/{$company->slug}")->assertStatus(200);
    }

    public function test_company_show_page_404s_for_unknown_slug(): void
    {
        $this->get('/company/does-not-exist')->assertStatus(404);
    }

    public function test_company_show_page_404s_for_hidden_company(): void
    {
        $company = Company::factory()->create(['status' => 'hidden']);

        $this->get("/company/{$company->slug}")->assertStatus(404);
    }

    public function test_area_show_page_loads_for_known_area(): void
    {
        $area = Area::first() ?? Area::create([
            'key' => 'test-area', 'label' => 'Test Area', 'lat' => 22.5, 'lng' => 88.4, 'default_zoom' => 14, 'sort_order' => 1,
        ]);

        $this->get("/area/{$area->key}")->assertStatus(200);
    }

    public function test_area_show_page_404s_for_unknown_area(): void
    {
        $this->get('/area/does-not-exist')->assertStatus(404);
    }

    public function test_sector_show_page_loads_for_known_sector(): void
    {
        $this->get('/sector/'.Str::slug('Fintech'))->assertStatus(200);
    }

    public function test_sector_show_page_404s_for_unknown_sector(): void
    {
        $this->get('/sector/not-a-real-sector')->assertStatus(404);
    }

    public function test_company_profile_never_leaks_ats_token(): void
    {
        $company = Company::factory()->create([
            'ats_provider' => 'greenhouse',
            'ats_token' => 'super-secret-token',
        ]);

        $response = $this->get("/company/{$company->slug}");

        $response->assertStatus(200);
        $response->assertDontSee('super-secret-token');
    }
}
