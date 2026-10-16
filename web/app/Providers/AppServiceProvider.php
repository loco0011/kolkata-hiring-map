<?php

namespace App\Providers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        if ($this->app->isProduction()) {
            // Behind a host's TLS proxy Laravel can think it's on http and emit
            // http:// asset/redirect URLs — trust APP_URL's scheme instead.
            if (str_starts_with((string) config('app.url'), 'https://')) {
                URL::forceScheme('https');
            }

            // Blocks migrate:fresh / db:wipe etc. from wiping the live database.
            DB::prohibitDestructiveCommands();
        }
    }
}
