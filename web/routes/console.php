<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('admin:make {email}', function (string $email) {
    $user = User::where('email', $email)->first();

    if (! $user) {
        $this->error("No user with email {$email}.");

        return 1;
    }

    $password = $this->secret('New password (leave blank to keep the current one)');

    if ($password !== null && $password !== '') {
        if (strlen($password) < 12) {
            $this->error('Use at least 12 characters.');

            return 1;
        }
        $user->password = Hash::make($password);
    }

    $user->forceFill(['is_admin' => true])->save();
    $this->info("{$email} is now an admin.");
})->purpose('Give a user admin (moderation) access and optionally reset their password');

// Run by the `scheduler` container (php artisan schedule:work); no server crontab needed.
// Docker Compose sets LINK_CHECKER=python, so the fetcher's check_links runs the check instead.
Schedule::command('postings:check')->dailyAt('03:30')->withoutOverlapping()
    ->when(fn () => config('services.ingest.link_checker') !== 'python');
