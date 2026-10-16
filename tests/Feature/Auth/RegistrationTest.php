<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Public self-registration is intentionally disabled — this product has no
     * candidate/employer accounts, only a seeded admin login. See routes/auth.php.
     */
    public function test_registration_routes_are_disabled(): void
    {
        $this->get('/register')->assertStatus(404);
        $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertStatus(404);

        $this->assertGuest();
    }
}
