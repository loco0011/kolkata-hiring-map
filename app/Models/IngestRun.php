<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IngestRun extends Model
{
    protected $fillable = [
        'source', 'started_at', 'finished_at', 'companies_scanned',
        'jobs_found', 'jobs_new', 'jobs_closed', 'errors',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'errors' => 'array',
        ];
    }
}
