<?php

use App\Http\Controllers\IngestController;
use Illuminate\Support\Facades\Route;

// Used only by the Python fetcher service in fetcher/ (see fetcher/README.md).
Route::middleware(['ingest.token', 'throttle:60,1'])->prefix('ingest')->group(function () {
    Route::get('/companies', [IngestController::class, 'companies']);
    Route::post('/jobs', [IngestController::class, 'jobs']);
    Route::get('/postings', [IngestController::class, 'postings']);
    Route::post('/checks', [IngestController::class, 'checks']);
});
