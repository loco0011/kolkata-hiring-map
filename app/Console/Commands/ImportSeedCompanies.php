<?php

namespace App\Console\Commands;

use App\Models\Area;
use App\Models\Company;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class ImportSeedCompanies extends Command
{
    protected $signature = 'seed:companies {--file=data/seed/companies.csv}';

    protected $description = 'Import verified companies from a CSV file. Idempotent on slug.';

    private const LAT_MIN = 22.40;

    private const LAT_MAX = 22.80;

    private const LNG_MIN = 88.24;

    private const LNG_MAX = 88.56;

    public function handle(): int
    {
        $path = base_path($this->option('file'));

        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $handle = fopen($path, 'r');
        $header = fgetcsv($handle);

        if ($header === false) {
            $this->error('CSV file is empty.');

            return self::FAILURE;
        }

        $header = array_map(fn ($h) => trim(strtolower($h)), $header);
        $areaKeys = Area::pluck('key')->flip();

        $imported = 0;
        $skipped = 0;
        $line = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $line++;

            if (count($row) !== count($header)) {
                $this->warn("Line {$line}: column count mismatch, skipping.");
                $skipped++;

                continue;
            }

            $data = array_combine($header, $row);

            $lat = (float) ($data['lat'] ?? 0);
            $lng = (float) ($data['lng'] ?? 0);

            if ($lat < self::LAT_MIN || $lat > self::LAT_MAX || $lng < self::LNG_MIN || $lng > self::LNG_MAX) {
                $this->warn("Line {$line}: lat/lng ({$lat}, {$lng}) outside Kolkata bounds, skipping.");
                $skipped++;

                continue;
            }

            if (empty($data['name'])) {
                $this->warn("Line {$line}: missing name, skipping.");
                $skipped++;

                continue;
            }

            $area = trim($data['area'] ?? '');

            if ($area !== '' && ! $areaKeys->has($area)) {
                $this->warn("Line {$line}: unknown area key '{$area}', clearing.");
                $area = null;
            }

            $slug = trim($data['slug'] ?? '') ?: Str::slug($data['name']);

            Company::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => trim($data['name']),
                    'legal_name' => $data['legal_name'] ?: null,
                    'website' => $data['website'] ?: null,
                    'type' => $data['type'] ?: null,
                    'sector' => $data['sector'] ?: null,
                    'size_band' => $data['size_band'] ?: null,
                    'founded_year' => $data['founded_year'] ?: null,
                    'address' => $data['address'] ?: null,
                    'area' => $area ?: null,
                    'lat' => $lat,
                    'lng' => $lng,
                    'funding_stage' => $data['funding_stage'] ?: null,
                    'careers_url' => $data['careers_url'] ?: null,
                    'is_verified' => filter_var($data['is_verified'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    'status' => 'live',
                ]
            );

            $imported++;
        }

        fclose($handle);

        $this->info("Imported/updated {$imported} companies. Skipped {$skipped} rows.");

        return self::SUCCESS;
    }
}
