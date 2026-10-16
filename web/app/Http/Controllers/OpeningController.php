<?php

namespace App\Http\Controllers;

use App\Models\JobPosting;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OpeningController extends Controller
{
    public function index(Request $request): Response
    {
        $openings = JobPosting::query()
            ->live()
            ->with('company:id,slug,name,logo_url,area,address,type,sector,size_band,founded_year,funding_stage,website')
            ->when($request->string('experience')->toString(), fn ($query, $exp) => $query->where('exp_bucket', $exp))
            ->when($request->boolean('internship_only'), fn ($query) => $query->where('is_internship', true))
            ->when($request->string('work_mode')->toString(), fn ($query, $mode) => $query->where('work_mode', $mode))
            ->orderByDesc('posted_at')
            ->paginate(30)
            ->withQueryString();

        return Inertia::render('Openings/Index', [
            'openings' => $openings,
            'filters' => $request->only(['experience', 'internship_only', 'work_mode']),
        ]);
    }
}
