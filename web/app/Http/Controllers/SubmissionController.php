<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SubmissionController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Submit');
    }

    public function store(Request $request): RedirectResponse
    {
        // Honeypot: a hidden field real users never fill. Bots that autofill every
        // field trip it; pretend success so they don't learn to skip it.
        if ($request->filled('website')) {
            return redirect()->route('submit')->with('success', 'Thanks — we\'ll review this within a few days.');
        }

        $validated = $request->validate([
            'kind' => ['required', 'in:company,job'],
            'company_name' => ['required', 'string', 'max:255'],
            'role' => ['nullable', 'required_if:kind,job', 'string', 'max:255'],
            'experience' => ['nullable', 'string', 'max:50'],
            'pay' => ['nullable', 'string', 'max:100'],
            'source_url' => ['required', 'url', 'max:2048'],
            'email' => ['nullable', 'email', 'max:255'],
        ]);

        Submission::create([
            'kind' => $validated['kind'],
            'payload' => [
                'company_name' => $validated['company_name'],
                'role' => $validated['role'] ?? null,
                'experience' => $validated['experience'] ?? null,
                'pay' => $validated['pay'] ?? null,
                'source_url' => $validated['source_url'],
            ],
            'submitter_email_hash' => isset($validated['email'])
                ? hash('sha256', $validated['email'].config('app.key'))
                : null,
            'status' => 'pending',
        ]);

        return redirect()->route('submit')->with('success', 'Thanks — we\'ll review this within a few days.');
    }
}
