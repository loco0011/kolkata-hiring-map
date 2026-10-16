<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ingest_runs', function (Blueprint $table) {
            $table->id();
            $table->enum('source', ['greenhouse', 'lever', 'ashby', 'workable', 'recruitee', 'jsonld', 'llm', 'closure']);
            $table->dateTime('started_at');
            $table->dateTime('finished_at')->nullable();
            $table->unsignedInteger('companies_scanned')->default(0);
            $table->unsignedInteger('jobs_found')->default(0);
            $table->unsignedInteger('jobs_new')->default(0);
            $table->unsignedInteger('jobs_closed')->default(0);
            $table->json('errors')->nullable();
            $table->timestamps();

            $table->index('source');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ingest_runs');
    }
};
