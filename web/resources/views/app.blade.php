<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0B1A22">
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        <script>
            (function () {
                try {
                    var theme = localStorage.getItem('khm-theme') || 'dark';
                    document.documentElement.setAttribute('data-theme', theme);
                    if (theme === 'light') {
                        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#ffffff');
                    }
                } catch (e) {}
            })();
        </script>

        <title inertia>{{ config('app.name', 'Laravel') }}</title>
        {{-- Static fallback meta for crawlers/social unfurlers that don't run JS (Inertia's
             per-page <Head> tags below only apply after client-side hydration — this app has
             no SSR, by design, since the hosting plan is PHP/MySQL only with no Node runtime). --}}
        <meta name="description" content="A live map of who is hiring in Kolkata, where, and at what pay.">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="{{ config('app.name') }}">
        <meta property="og:title" content="{{ config('app.name') }}">
        <meta property="og:description" content="A live map of who is hiring in Kolkata, where, and at what pay.">
        <meta name="twitter:card" content="summary">
        <meta name="twitter:title" content="{{ config('app.name') }}">
        <meta name="twitter:description" content="A live map of who is hiring in Kolkata, where, and at what pay.">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Anek+Latin:wght@500;600;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
