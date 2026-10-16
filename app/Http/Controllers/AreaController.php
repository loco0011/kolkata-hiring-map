<?php

namespace App\Http\Controllers;

use App\Models\Area;
use Inertia\Inertia;
use Inertia\Response;

class AreaController extends Controller
{
    public function show(string $key): Response
    {
        $area = Area::query()
            ->where('key', $key)
            ->with(['companies' => fn ($query) => $query
                ->where('status', 'live')
                ->withCount(['liveJobPostings as live_job_postings_count'])
                ->orderByDesc('live_job_postings_count'),
            ])
            ->firstOrFail();

        return Inertia::render('Area/Show', [
            'area' => $area,
        ]);
    }
}
