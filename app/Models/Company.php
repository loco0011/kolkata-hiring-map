<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    use HasFactory, HasUuidPrimaryKey;

    public const TYPES = [
        'Startup', 'Product', 'IT Services', 'GCC', 'BFSI', 'Manufacturing',
        'Agency', 'Enabler', 'Services', 'Retail', 'Media',
    ];

    public const SECTORS = [
        'SaaS', 'Fintech', 'AI', 'Healthtech', 'Edtech', 'D2C', 'Foodtech',
        'Mobility', 'Cleantech', 'Media', 'Consulting', 'Other',
    ];

    /** Job boards the Python fetcher (fetcher/ingest/sources) can read. */
    public const ATS_PROVIDERS = [
        'greenhouse', 'lever', 'ashby', 'workable', 'recruitee',
        'freshteam', 'darwinbox', 'keka', 'zohorecruit',
    ];

    /**
     * Board tokens are the slug in the board URL (boards.greenhouse.io/<token>, <token>.keka.com).
     * The fetcher puts them into API URLs, often as a subdomain, so only plain slugs are allowed.
     * Same pattern as fetcher/ingest/sources/__init__.py.
     */
    public const ATS_TOKEN_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/';

    /**
     * Zoho Recruit's token is the whole careers host: acme.zohorecruit.in and acme.zohorecruit.com
     * can be different organisations. Same pattern as fetcher/ingest/sources/zohorecruit.py.
     */
    public const ZOHO_HOST_PATTERN = '/^[a-z0-9][a-z0-9-]*\.zohorecruit\.(com|in|eu|com\.au|jp)$/';

    protected $fillable = [
        'slug', 'name', 'legal_name', 'website', 'logo_url', 'type', 'sector',
        'size_band', 'founded_year', 'address', 'area', 'lat', 'lng',
        'funding_stage', 'is_verified', 'status', 'careers_url', 'ats_provider',
        'ats_token', 'last_crawled_at', 'content_hash',
    ];

    // ats_token is an ingestion credential and content_hash/last_crawled_at are internal
    // bookkeeping — none of these should ever reach the frontend via Inertia, which
    // serializes whole models passed to it.
    protected $hidden = ['ats_token', 'content_hash', 'last_crawled_at'];

    protected function casts(): array
    {
        return [
            'lat' => 'decimal:6',
            'lng' => 'decimal:6',
            'is_verified' => 'boolean',
            'last_crawled_at' => 'datetime',
        ];
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class, 'area', 'key');
    }

    public function jobPostings(): HasMany
    {
        return $this->hasMany(JobPosting::class);
    }

    public function liveJobPostings(): HasMany
    {
        return $this->jobPostings()
            ->where('status', 'live')
            ->where('last_seen_at', '>=', now()->subDays(JobPosting::LIVE_WINDOW_DAYS));
    }
}
