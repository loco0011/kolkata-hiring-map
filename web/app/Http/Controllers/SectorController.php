<?php

namespace App\Http\Controllers;

use App\Models\Company;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SectorController extends Controller
{
    private const SECTORS = [
        'SaaS', 'Fintech', 'AI', 'Healthtech', 'Edtech', 'D2C', 'Foodtech',
        'Mobility', 'Cleantech', 'Media', 'Consulting', 'Other',
    ];

    public function show(string $key): Response
    {
        $sector = collect(self::SECTORS)->first(fn ($s) => Str::slug($s) === $key);

        if (! $sector) {
            throw new NotFoundHttpException;
        }

        $companies = Company::query()
            ->where('sector', $sector)
            ->where('status', 'live')
            ->withCount(['liveJobPostings as live_job_postings_count'])
            ->orderByDesc('live_job_postings_count')
            ->get();

        return Inertia::render('Sector/Show', [
            'sector' => $sector,
            'sectorKey' => $key,
            'companies' => $companies,
        ]);
    }
}
