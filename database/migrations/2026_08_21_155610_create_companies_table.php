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
        Schema::create('companies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('legal_name')->nullable();
            $table->string('website')->nullable();
            $table->string('logo_url')->nullable();
            $table->enum('type', [
                'Startup', 'Product', 'IT Services', 'GCC', 'BFSI', 'Manufacturing',
                'Agency', 'Enabler', 'Services', 'Retail', 'Media',
            ])->nullable();
            $table->enum('sector', [
                'SaaS', 'Fintech', 'AI', 'Healthtech', 'Edtech', 'D2C', 'Foodtech',
                'Mobility', 'Cleantech', 'Media', 'Consulting', 'Other',
            ])->nullable();
            $table->enum('size_band', ['1-10', '11-50', '51-200', '201-1000', '1000+'])->nullable();
            $table->unsignedSmallInteger('founded_year')->nullable();
            $table->string('address')->nullable();
            $table->string('area')->nullable();
            $table->foreign('area')->references('key')->on('areas')->nullOnDelete();
            $table->decimal('lat', 9, 6);
            $table->decimal('lng', 9, 6);
            $table->enum('funding_stage', [
                'Bootstrapped', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+',
                'Public', 'Acquired',
            ])->nullable();
            $table->boolean('is_verified')->default(false);
            $table->enum('status', ['live', 'hidden', 'duplicate'])->default('live');
            $table->string('careers_url')->nullable();
            $table->enum('ats_provider', ['greenhouse', 'lever', 'ashby', 'workable', 'recruitee'])->nullable();
            $table->string('ats_token')->nullable();
            $table->timestamp('last_crawled_at')->nullable();
            $table->string('content_hash')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('area');
            $table->index('sector');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
