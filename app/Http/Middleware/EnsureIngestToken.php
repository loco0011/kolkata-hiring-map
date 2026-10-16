<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards /api/ingest/* — only the Python fetcher service, holding INGEST_API_TOKEN,
 * may call it. With no token configured the API is off rather than open.
 */
class EnsureIngestToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = (string) config('services.ingest.token');

        if ($token === '') {
            abort(503, 'Ingest API is not configured.');
        }

        if (! hash_equals($token, (string) $request->bearerToken())) {
            abort(401, 'Invalid ingest token.');
        }

        return $next($request);
    }
}
