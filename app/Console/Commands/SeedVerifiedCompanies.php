<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\JobPosting;
use Illuminate\Console\Command;

class SeedVerifiedCompanies extends Command
{
    protected $signature = 'seed:verified';

    protected $description = 'Seed real, individually-verified Kolkata companies and their currently-live job postings (researched via web search + careers-page fetch, not fabricated). Idempotent on slug.';

    public function handle(): int
    {
        $companies = $this->companies();
        $created = 0;
        $jobsCreated = 0;

        foreach ($companies as $data) {
            $jobs = $data['jobs'];
            unset($data['jobs']);

            $company = Company::updateOrCreate(
                ['slug' => $data['slug']],
                [...$data, 'status' => 'live']
            );
            $created++;

            foreach ($jobs as $job) {
                $titleNorm = JobPosting::normalizeTitle($job['title']);

                JobPosting::updateOrCreate(
                    [
                        'company_id' => $company->id,
                        'title_norm' => $titleNorm,
                        'exp_bucket' => $job['exp_bucket'],
                    ],
                    [
                        'title' => $job['title'],
                        'is_internship' => $job['is_internship'] ?? false,
                        'is_fresher_ok' => $job['is_fresher_ok'] ?? false,
                        'work_mode' => $job['work_mode'] ?? 'onsite',
                        'pay_min' => $job['pay_min'] ?? null,
                        'pay_max' => $job['pay_max'] ?? null,
                        'pay_period' => $job['pay_period'] ?? null,
                        'pay_is_disclosed' => $job['pay_is_disclosed'] ?? false,
                        'source' => $job['source'],
                        'source_label' => $job['source_label'],
                        'apply_url' => $job['apply_url'],
                        'posted_at' => $job['confirmed_live_on'],
                        'first_seen_at' => $job['confirmed_live_on'],
                        'last_seen_at' => now(),
                        'status' => 'live',
                    ]
                );
                $jobsCreated++;
            }
        }

        $this->info("Seeded {$created} verified companies and {$jobsCreated} verified job postings.");
        $this->comment('Every apply_url here is a real, checked link (a specific live posting, or the company\'s own careers page where no single posting could be pinned). Re-verify periodically — postings go stale.');

        return self::SUCCESS;
    }

    /**
     * Every entry below was individually verified in September 2026 via web search and a
     * fetch of the company's own careers page (or a job board listing linking to it).
     * Where no specific live posting could be confirmed, `jobs` is left empty rather than
     * inventing one — see PROGRESS.md for why fabricated listings are a real trust risk here.
     */
    private function companies(): array
    {
        return [
            [
                'slug' => 'indus-net-technologies', 'name' => 'Indus Net Technologies',
                'website' => 'https://www.indusnet.co.in', 'careers_url' => 'https://indusnet.freshteam.com/jobs',
                'type' => 'IT Services', 'sector' => 'SaaS', 'size_band' => '201-1000',
                'address' => 'Ambuja Ecospace Business Park, New Town', 'area' => 'rajarhat-new-town',
                'lat' => 22.5885, 'lng' => 88.4752, 'is_verified' => true,
                'jobs' => [
                    ['title' => 'Java Developer', 'exp_bucket' => '3+ yr', 'is_fresher_ok' => false, 'source' => 'careers', 'source_label' => 'Careers page', 'apply_url' => 'https://indusnet.freshteam.com/jobs/ppxSxfeaQeBR/java-developer', 'confirmed_live_on' => '2026-09-10'],
                ],
            ],
            [
                'slug' => 'mihup', 'name' => 'Mihup',
                'website' => 'https://mihup.ai', 'careers_url' => 'https://cutshort.io/company/mihup-65-6RrTh3Nq',
                'type' => 'Product', 'sector' => 'AI', 'size_band' => '51-200',
                'address' => 'Millennium City IT Park, Tower 2, DN-62, Sector V', 'area' => 'salt-lake-sector-v',
                'lat' => 22.5749, 'lng' => 88.4322, 'is_verified' => true,
                'jobs' => [
                    ['title' => 'AI Engineer — R&D', 'exp_bucket' => '3+ yr', 'is_fresher_ok' => true, 'pay_min' => 2000000, 'pay_max' => 7000000, 'pay_period' => 'annual', 'pay_is_disclosed' => true, 'source' => 'careers', 'source_label' => 'Job board', 'apply_url' => 'https://cutshort.io/job/AI-Engineer-R-D-Kolkata-Bengaluru-Bangalore-Mihup-5PRkxxUo', 'confirmed_live_on' => '2026-09-10'],
                ],
            ],
            [
                'slug' => 'stockedge', 'name' => 'StockEdge',
                'website' => 'https://stockedge.com', 'careers_url' => 'https://stockedge.com/careers',
                'type' => 'Product', 'sector' => 'Fintech', 'size_band' => '51-200',
                'address' => 'Sector V, Salt Lake', 'area' => 'salt-lake-sector-v',
                'lat' => 22.5762, 'lng' => 88.4298, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'capgemini-new-town', 'name' => 'Capgemini (New Town)',
                'website' => 'https://www.capgemini.com', 'careers_url' => 'https://jobs.capgemini.com',
                'type' => 'IT Services', 'sector' => 'SaaS', 'size_band' => '1000+',
                'address' => 'Unitech Infospace, Tower A3, New Town, Rajarhat', 'area' => 'rajarhat-new-town',
                'lat' => 22.5872, 'lng' => 88.4737, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'bandhan-bank', 'name' => 'Bandhan Bank',
                'website' => 'https://www.bandhanbank.com', 'careers_url' => 'https://www.bandhan.bank.in/careers',
                'type' => 'BFSI', 'sector' => 'Fintech', 'size_band' => '1000+',
                'address' => 'DN-32, Sector V, Salt Lake', 'area' => 'salt-lake-sector-v',
                'lat' => 22.5748, 'lng' => 88.4318, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'senco-gold-diamonds', 'name' => 'Senco Gold & Diamonds',
                'website' => 'https://www.sencogoldanddiamonds.com', 'careers_url' => 'https://sencogold.com/career',
                'type' => 'Retail', 'sector' => 'D2C', 'size_band' => '1000+',
                'address' => 'Diamond Prestige, 41A AJC Bose Road', 'area' => 'camac-street',
                'lat' => 22.5459, 'lng' => 88.3624, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'vikram-solar', 'name' => 'Vikram Solar',
                'website' => 'https://www.vikramsolar.com', 'careers_url' => 'https://www.vikramsolar.com/vacancies/',
                'type' => 'Manufacturing', 'sector' => 'Cleantech', 'size_band' => '1000+',
                'address' => 'Biowonder, Anandapur Main Road, EM Bypass', 'area' => 'em-bypass',
                'lat' => 22.5142, 'lng' => 88.3958, 'is_verified' => true,
                'jobs' => [
                    ['title' => 'Manager — Bidding & Tendering', 'exp_bucket' => '3+ yr', 'is_fresher_ok' => false, 'source' => 'careers', 'source_label' => 'Careers page', 'apply_url' => 'https://www.vikramsolar.com/vacancies/', 'confirmed_live_on' => '2026-09-10'],
                ],
            ],
            [
                'slug' => 'lumino-industries', 'name' => 'Lumino Industries',
                'website' => 'https://luminoindustries.com', 'careers_url' => 'https://luminoindustries.com/careers/',
                'type' => 'Manufacturing', 'sector' => 'Other', 'size_band' => '201-1000',
                'address' => 'Merlin Acropolis, Rajdanga Main Road', 'area' => 'kasba',
                'lat' => 22.5155, 'lng' => 88.3945, 'is_verified' => true,
                'jobs' => [
                    ['title' => 'Safety Officer — Factory (Jangalpur unit)', 'exp_bucket' => '3+ yr', 'is_fresher_ok' => false, 'source' => 'careers', 'source_label' => 'Careers page', 'apply_url' => 'https://luminoindustries.com/careers/', 'confirmed_live_on' => '2026-09-10'],
                ],
            ],
            [
                'slug' => 'iim-calcutta-innovation-park', 'name' => 'IIM Calcutta Innovation Park',
                'website' => 'https://iimcip.org', 'careers_url' => 'https://in.linkedin.com/company/iim-calcutta-innovation-park',
                'type' => 'Enabler', 'sector' => 'Other', 'size_band' => '51-200',
                'address' => 'IIM Calcutta Campus, Joka', 'area' => 'garia',
                'lat' => 22.4553, 'lng' => 88.3200, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'tcs-gitanjali-park', 'name' => 'TCS Gitanjali Park',
                'website' => 'https://www.tcs.com', 'careers_url' => 'https://www.tcs.com/careers',
                'type' => 'IT Services', 'sector' => 'SaaS', 'size_band' => '1000+',
                'address' => 'Plot II/F/3, Action Area II, Gitanjali Road, New Town', 'area' => 'rajarhat-new-town',
                'lat' => 22.6048, 'lng' => 88.4801, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'genpact-candor-techspace', 'name' => 'Genpact',
                'website' => 'https://www.genpact.com', 'careers_url' => 'https://www.genpact.com/careers',
                'type' => 'GCC', 'sector' => 'Consulting', 'size_band' => '1000+',
                'address' => 'Candor Techspace, Unitech Infospace, DH Block, Action Area I, New Town', 'area' => 'rajarhat-new-town',
                'lat' => 22.5813, 'lng' => 88.4693, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'wipro-sector-v', 'name' => 'Wipro',
                'website' => 'https://www.wipro.com', 'careers_url' => 'https://careers.wipro.com',
                'type' => 'IT Services', 'sector' => 'SaaS', 'size_band' => '1000+',
                'address' => 'Plot 1, 7 & 8, Block DM, Sector V, Salt Lake', 'area' => 'salt-lake-sector-v',
                'lat' => 22.5731, 'lng' => 88.4289, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'pwc-sdc-kolkata', 'name' => 'PwC Service Delivery Centre Kolkata',
                'website' => 'https://www.pwc.in', 'careers_url' => 'https://www.pwc.in/careers/sdc-kolkata-jobs.html',
                'type' => 'GCC', 'sector' => 'Consulting', 'size_band' => '1000+',
                'address' => 'South City Pinnacle, 13th Floor, Block EP, Sector V, Salt Lake', 'area' => 'salt-lake-sector-v',
                'lat' => 22.5712, 'lng' => 88.4301, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'itc-limited', 'name' => 'ITC Limited',
                'website' => 'https://www.itcportal.com', 'careers_url' => 'https://www.itcportal.com/careers.html',
                'type' => 'Manufacturing', 'sector' => 'Consulting', 'size_band' => '1000+',
                'address' => 'Virginia House, 37 J.L. Nehru Road', 'area' => 'park-street',
                'lat' => 22.5511, 'lng' => 88.3517, 'is_verified' => true,
                'jobs' => [
                    ['title' => 'Assistant Undertrainee (AUT) — Management Trainee Programme', 'exp_bucket' => 'Fresher', 'is_fresher_ok' => true, 'source' => 'careers', 'source_label' => 'Careers page', 'apply_url' => 'https://www.itcportal.com/careers.html', 'confirmed_live_on' => '2026-09-10'],
                ],
            ],
            [
                'slug' => 'cesc-limited', 'name' => 'CESC Limited',
                'website' => 'https://www.cesc.co.in', 'careers_url' => 'https://www.cesc.co.in/careers',
                'type' => 'Manufacturing', 'sector' => 'Other', 'size_band' => '1000+',
                'address' => 'Victoria House, Dharmatala', 'area' => 'esplanade-bbd-bagh',
                'lat' => 22.5658, 'lng' => 88.3506, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'wow-momo', 'name' => 'Wow! Momo',
                'website' => 'https://www.wowmomo.com', 'careers_url' => 'https://www.wowmomo.com',
                'type' => 'Startup', 'sector' => 'Foodtech', 'size_band' => '1000+',
                'address' => 'Sector C, EM Bypass (near Ruby Hospital)', 'area' => 'em-bypass',
                'lat' => 22.5115, 'lng' => 88.4029, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'emami-limited', 'name' => 'Emami Limited',
                'website' => 'https://www.emamiltd.in', 'careers_url' => 'https://www.emamiltd.in/people/apply-now/',
                'type' => 'Manufacturing', 'sector' => 'D2C', 'size_band' => '1000+',
                'address' => 'Emami Tower, 687 Anandapur, EM Bypass', 'area' => 'em-bypass',
                'lat' => 22.5087, 'lng' => 88.3980, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'exide-industries', 'name' => 'Exide Industries',
                'website' => 'https://www.exideindustries.com', 'careers_url' => 'https://careers.exideindustries.com/',
                'type' => 'Manufacturing', 'sector' => 'Cleantech', 'size_band' => '1000+',
                'address' => 'Exide House, 59E Chowringhee Road', 'area' => 'park-street',
                'lat' => 22.5476, 'lng' => 88.3512, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'peerless-financial-services', 'name' => 'Peerless Financial Services',
                'website' => 'https://www.peerless.co.in', 'careers_url' => 'https://peerless.co.in/contact-us',
                'type' => 'BFSI', 'sector' => 'Fintech', 'size_band' => '201-1000',
                'address' => 'Peerless Bhavan, 3 Esplanade East', 'area' => 'esplanade-bbd-bagh',
                'lat' => 22.5651, 'lng' => 88.3524, 'is_verified' => true,
                'jobs' => [],
            ],
            [
                'slug' => 'birla-corporation', 'name' => 'Birla Corporation',
                'website' => 'https://www.birlacorporation.com', 'careers_url' => 'https://birlacorp.darwinbox.in/ms/candidatev2/main/careers/home',
                'type' => 'Manufacturing', 'sector' => 'Other', 'size_band' => '1000+',
                'address' => '1 Shakespeare Sarani', 'area' => 'camac-street',
                'lat' => 22.5423, 'lng' => 88.3548, 'is_verified' => true,
                'jobs' => [],
            ],
        ];
    }
}
