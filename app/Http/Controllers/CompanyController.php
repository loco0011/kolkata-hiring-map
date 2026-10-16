<?php

namespace App\Http\Controllers;

use App\Models\Company;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    public function show(string $slug): Response
    {
        $company = Company::query()
            ->where('slug', $slug)
            ->where('status', 'live')
            ->with(['liveJobPostings' => fn ($query) => $query->orderByDesc('posted_at')])
            ->firstOrFail();

        return Inertia::render('Company/Show', [
            'company' => $company,
        ]);
    }
}
