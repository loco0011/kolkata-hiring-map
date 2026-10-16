<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AreaController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\MapController;
use App\Http\Controllers\OpeningController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\RobotsController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SectorController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\SubmissionController;
use Illuminate\Support\Facades\Route;

Route::get('/', MapController::class)->name('map');

Route::get('/company/{slug}', [CompanyController::class, 'show'])->name('company.show');
Route::get('/area/{key}', [AreaController::class, 'show'])->name('area.show');
Route::get('/sector/{key}', [SectorController::class, 'show'])->name('sector.show');
Route::get('/openings', [OpeningController::class, 'index'])->name('openings.index');
Route::get('/about', [PageController::class, 'about'])->name('about');
Route::get('/sitemap.xml', SitemapController::class)->name('sitemap');
Route::get('/robots.txt', RobotsController::class)->name('robots');

Route::get('/submit', [SubmissionController::class, 'create'])->name('submit');
Route::post('/submit', [SubmissionController::class, 'store'])
    ->middleware('throttle:5,1')
    ->name('submit.store');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

// Moderation — only users with is_admin (see DatabaseSeeder / DEPLOY.md).
Route::middleware(['auth', 'admin'])->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('dashboard');
    Route::patch('/admin/submissions/{submission}', [AdminController::class, 'reviewSubmission'])->name('admin.submissions.review');
    Route::post('/admin/companies', [AdminController::class, 'storeCompany'])->name('admin.companies.store');
    Route::patch('/admin/companies/{company}/sources', [AdminController::class, 'updateJobSources'])->name('admin.companies.sources');
    Route::post('/admin/postings', [AdminController::class, 'storePosting'])->name('admin.postings.store');
    Route::patch('/admin/postings/{posting}/confirm', [AdminController::class, 'confirmPosting'])->name('admin.postings.confirm');
    Route::patch('/admin/postings/{posting}/close', [AdminController::class, 'closePosting'])->name('admin.postings.close');
});

require __DIR__.'/auth.php';
