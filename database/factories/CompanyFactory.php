<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

class CompanyFactory extends Factory
{
    protected $model = Company::class;

    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'slug' => str($name)->slug(),
            'name' => $name,
            'website' => fake()->domainName(),
            'type' => fake()->randomElement(['Startup', 'Product', 'IT Services', 'GCC', 'BFSI']),
            'sector' => fake()->randomElement(['SaaS', 'Fintech', 'AI', 'Healthtech', 'Other']),
            'size_band' => fake()->randomElement(['1-10', '11-50', '51-200', '201-1000', '1000+']),
            'address' => fake()->streetAddress(),
            'area' => null,
            'lat' => fake()->latitude(22.45, 22.65),
            'lng' => fake()->longitude(88.25, 88.48),
            'is_verified' => false,
            'status' => 'live',
        ];
    }
}
