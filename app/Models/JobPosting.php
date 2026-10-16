<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class JobPosting extends Model
{
    use HasFactory, HasUuidPrimaryKey;

    public const EXP_BUCKETS = ['Intern', 'Fresher', '1-3 yr', '3+ yr'];

    public const WORK_MODES = ['onsite', 'hybrid', 'remote'];

    public const SOURCES = ['linkedin', 'naukri', 'internshala', 'careers', 'self', 'ats'];

    /** Postings not confirmed live within this many days drop off the public site. */
    public const LIVE_WINDOW_DAYS = 21;

    /** Consecutive dead link checks before a posting is closed, so one flaky request never takes it down. */
    public const STRIKES_TO_CLOSE = 2;

    protected $fillable = [
        'company_id', 'title', 'title_norm', 'department', 'exp_bucket',
        'is_internship', 'is_fresher_ok', 'work_mode', 'pay_min', 'pay_max',
        'pay_period', 'pay_is_disclosed', 'source', 'source_label', 'apply_url',
        'posted_at', 'first_seen_at', 'last_seen_at', 'closed_at', 'status',
        'extraction_confidence', 'check_failures', 'last_checked_at',
    ];

    protected function casts(): array
    {
        return [
            'is_internship' => 'boolean',
            'is_fresher_ok' => 'boolean',
            'pay_is_disclosed' => 'boolean',
            'posted_at' => 'date',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'closed_at' => 'datetime',
            'last_checked_at' => 'datetime',
            'extraction_confidence' => 'decimal:2',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public static function normalizeTitle(string $title): string
    {
        return Str::of($title)
            ->lower()
            ->replaceMatches('/[^a-z0-9\s]/', '')
            ->squish()
            ->toString();
    }

    /**
     * Applies one link-check result (from `postings:check` or the Python fetcher's
     * check_links) and saves. Returns true when this check closed the posting.
     *
     * @param  'alive'|'dead'|'unknown'  $result
     */
    public function recordCheck(string $result): bool
    {
        $this->last_checked_at = now();
        $closed = false;

        if ($result === 'alive') {
            $this->last_seen_at = now();
            $this->check_failures = 0;
        } elseif ($result === 'dead') {
            $this->check_failures++;
            if ($this->check_failures >= self::STRIKES_TO_CLOSE) {
                $this->status = 'closed';
                $this->closed_at = now();
                $closed = true;
            }
        }

        $this->save();

        return $closed;
    }

    public function scopeLive($query)
    {
        return $query->where('status', 'live')
            ->where('last_seen_at', '>=', now()->subDays(self::LIVE_WINDOW_DAYS));
    }
}
