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
        Schema::create('job_postings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->string('title');
            $table->string('title_norm');
            $table->string('department')->nullable();
            $table->enum('exp_bucket', ['Intern', 'Fresher', '1-3 yr', '3+ yr'])->nullable();
            $table->boolean('is_internship')->default(false);
            $table->boolean('is_fresher_ok')->default(false);
            $table->enum('work_mode', ['onsite', 'hybrid', 'remote'])->nullable();
            $table->integer('pay_min')->nullable();
            $table->integer('pay_max')->nullable();
            $table->enum('pay_period', ['annual', 'monthly'])->nullable();
            $table->boolean('pay_is_disclosed')->default(false);
            $table->enum('source', ['linkedin', 'naukri', 'internshala', 'careers', 'self', 'ats']);
            $table->string('source_label')->nullable();
            $table->string('apply_url');
            $table->date('posted_at')->nullable();
            $table->dateTime('first_seen_at');
            $table->dateTime('last_seen_at');
            $table->dateTime('closed_at')->nullable();
            $table->enum('status', ['live', 'closed', 'flagged'])->default('live');
            $table->decimal('extraction_confidence', 3, 2)->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'title_norm', 'exp_bucket'], 'job_postings_dedupe_unique');
            $table->index('status');
            $table->index('last_seen_at');
            $table->index('is_internship');
            $table->index('is_fresher_ok');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_postings');
    }
};
