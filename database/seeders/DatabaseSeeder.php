<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Never fall back to a guessable password: use ADMIN_PASSWORD if set,
        // otherwise generate a random one and print it once.
        $email = env('ADMIN_EMAIL', 'admin@kolkatahiringmap.com');
        $password = env('ADMIN_PASSWORD') ?: Str::password(20);

        if (! User::where('email', $email)->exists()) {
            User::factory()->create([
                'name' => 'Admin',
                'email' => $email,
                'password' => Hash::make($password),
            ])->forceFill(['is_admin' => true])->save();

            if (! env('ADMIN_PASSWORD')) {
                $this->command?->warn("Admin created: {$email} / {$password}  — save this now, it won't be shown again.");
            }
        }

        $this->call(AreaSeeder::class);

        // Not called here: this class runs under WithoutModelEvents, which silently
        // disables the `creating` hook that generates UUID primary keys for Company/
        // JobPosting (see HasUuidPrimaryKey) and breaks inserts. Run separately:
        //   php artisan seed:verified
    }
}
