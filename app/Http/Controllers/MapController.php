<?php

namespace App\Http\Controllers;

use App\Models\Area;
use App\Models\Company;
use App\Models\JobPosting;
use Inertia\Inertia;
use Inertia\Response;

class MapController extends Controller
{
    public function __invoke(): Response
    {
        $companies = Company::query()
            ->where('status', 'live')
            ->with(['liveJobPostings' => fn ($query) => $query->orderByDesc('posted_at')])
            ->get(['id', 'slug', 'name', 'logo_url', 'website', 'type', 'sector', 'area', 'address', 'lat', 'lng', 'is_verified'])
            ->map(fn (Company $company) => [
                'id' => $company->id,
                'slug' => $company->slug,
                'name' => $company->name,
                'logo_url' => $company->logo_url,
                'website' => $company->website,
                'type' => $company->type,
                'sector' => $company->sector,
                'area' => $company->area,
                'address' => $company->address,
                'lat' => (float) $company->lat,
                'lng' => (float) $company->lng,
                'is_verified' => $company->is_verified,
                'jobs' => $company->liveJobPostings->map(fn (JobPosting $job) => [
                    'id' => $job->id,
                    'title' => $job->title,
                    'exp_bucket' => $job->exp_bucket,
                    'is_internship' => $job->is_internship,
                    'is_fresher_ok' => $job->is_fresher_ok,
                    'work_mode' => $job->work_mode,
                    'pay_min' => $job->pay_min,
                    'pay_max' => $job->pay_max,
                    'pay_period' => $job->pay_period,
                    'pay_is_disclosed' => $job->pay_is_disclosed,
                    'source_label' => $job->source_label ?: ucfirst($job->source),
                    'apply_url' => $job->apply_url,
                    'days_ago' => $job->posted_at ? (int) $job->posted_at->diffInDays(now(), true) : null,
                ])->values(),
            ]);

        $areas = Area::query()
            ->orderBy('sort_order')
            ->get(['key', 'label', 'lat', 'lng', 'default_zoom']);

        return Inertia::render('Map/Index', [
            'companies' => $companies,
            'areas' => $areas,
            'sectors' => Company::SECTORS,
            'types' => Company::TYPES,
            'experienceBuckets' => JobPosting::EXP_BUCKETS,
        ]);
    }
}
