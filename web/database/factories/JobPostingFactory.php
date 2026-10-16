<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\JobPosting;
use Illuminate\Database\Eloquent\Factories\Factory;

class JobPostingFactory extends Factory
{
    protected $model = JobPosting::class;

    public function definition(): array
    {
        $title = fake()->jobTitle();

        return [
            'company_id' => Company::factory(),
            'title' => $title,
            'title_norm' => JobPosting::normalizeTitle($title),
            'exp_bucket' => fake()->randomElement(['Intern', 'Fresher', '1-3 yr', '3+ yr']),
            'is_internship' => false,
            'is_fresher_ok' => true,
            'work_mode' => 'onsite',
            'pay_is_disclosed' => false,
            'source' => 'careers',
            'source_label' => 'Careers page',
            'apply_url' => fake()->url(),
            'posted_at' => now()->subDays(2),
            'first_seen_at' => now()->subDays(2),
            'last_seen_at' => now(),
            'status' => 'live',
        ];
    }
}
