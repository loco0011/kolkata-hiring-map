<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('email');
        });

        // Bookkeeping for `php artisan postings:check` — two consecutive dead
        // results close a posting, so one flaky request never takes it down.
        Schema::table('job_postings', function (Blueprint $table) {
            $table->unsignedTinyInteger('check_failures')->default(0)->after('status');
            $table->dateTime('last_checked_at')->nullable()->after('check_failures');
        });
    }

    public function down(): void
    {
        Schema::table('job_postings', function (Blueprint $table) {
            $table->dropColumn(['check_failures', 'last_checked_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_admin');
        });
    }
};
