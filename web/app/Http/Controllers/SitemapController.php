<?php

namespace App\Http\Controllers;

use App\Models\Area;
use App\Models\Company;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class SitemapController extends Controller
{
    private const SECTORS = [
        'SaaS', 'Fintech', 'AI', 'Healthtech', 'Edtech', 'D2C', 'Foodtech',
        'Mobility', 'Cleantech', 'Media', 'Consulting', 'Other',
    ];

    public function __invoke(): Response
    {
        $urls = Cache::remember('sitemap.urls', now()->addHours(6), function () {
            $urls = collect([
                ['loc' => route('map'), 'changefreq' => 'daily', 'priority' => '1.0'],
                ['loc' => route('openings.index'), 'changefreq' => 'daily', 'priority' => '0.9'],
                ['loc' => route('about'), 'changefreq' => 'monthly', 'priority' => '0.3'],
                ['loc' => route('submit'), 'changefreq' => 'monthly', 'priority' => '0.3'],
            ]);

            Company::query()->where('status', 'live')->select('slug', 'updated_at')->each(function (Company $company) use (&$urls) {
                $urls->push([
                    'loc' => route('company.show', $company->slug),
                    'lastmod' => $company->updated_at->toAtomString(),
                    'changefreq' => 'weekly',
                    'priority' => '0.7',
                ]);
            });

            Area::query()->select('key')->each(function (Area $area) use (&$urls) {
                $urls->push([
                    'loc' => route('area.show', $area->key),
                    'changefreq' => 'daily',
                    'priority' => '0.6',
                ]);
            });

            foreach (self::SECTORS as $sector) {
                $urls->push([
                    'loc' => route('sector.show', Str::slug($sector)),
                    'changefreq' => 'daily',
                    'priority' => '0.6',
                ]);
            }

            return $urls;
        });

        $xml = view('sitemap', ['urls' => $urls])->render();

        return response($xml, 200)->header('Content-Type', 'application/xml');
    }
}
