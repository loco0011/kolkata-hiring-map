<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Freshteam, Darwinbox, Keka and Zoho Recruit — the boards Indian employers
 * actually use — alongside the original five. See fetcher/ingest/sources/.
 */
return new class extends Migration
{
    private const OLD_PROVIDERS = ['greenhouse', 'lever', 'ashby', 'workable', 'recruitee'];

    private const NEW_PROVIDERS = ['freshteam', 'darwinbox', 'keka', 'zohorecruit'];

    private const OTHER_RUN_SOURCES = ['jsonld', 'llm', 'closure'];

    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->enum('ats_provider', [...self::OLD_PROVIDERS, ...self::NEW_PROVIDERS])->nullable()->change();
        });

        Schema::table('ingest_runs', function (Blueprint $table) {
            $table->enum('source', [...self::OLD_PROVIDERS, ...self::NEW_PROVIDERS, ...self::OTHER_RUN_SOURCES])->change();
        });
    }

    public function down(): void
    {
        // Rows using a new provider can't fit the old enum; drop them back to "no board".
        DB::table('companies')->whereIn('ats_provider', self::NEW_PROVIDERS)->update(['ats_provider' => null, 'ats_token' => null]);
        DB::table('ingest_runs')->whereIn('source', self::NEW_PROVIDERS)->delete();

        Schema::table('companies', function (Blueprint $table) {
            $table->enum('ats_provider', self::OLD_PROVIDERS)->nullable()->change();
        });

        Schema::table('ingest_runs', function (Blueprint $table) {
            $table->enum('source', [...self::OLD_PROVIDERS, ...self::OTHER_RUN_SOURCES])->change();
        });
    }
};
