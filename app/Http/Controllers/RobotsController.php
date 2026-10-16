<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

class RobotsController extends Controller
{
    public function __invoke(): Response
    {
        $body = "User-agent: *\nDisallow:\n\nSitemap: ".route('sitemap')."\n";

        return response($body, 200)->header('Content-Type', 'text/plain');
    }
}
