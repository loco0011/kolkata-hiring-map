<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0B1A22">
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        <title>{{ $title ?? 'Error' }} — Kolkata Hiring Map</title>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Anek+Latin:wght@600;800&family=Manrope:wght@400;500&display=swap" rel="stylesheet" />
        <style>
            body {
                margin: 0;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: #0b1a22;
                color: #e8f1f3;
                font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
                text-align: center;
                padding: 1.5rem;
            }
            .code { font-family: 'Anek Latin', sans-serif; font-size: 4rem; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
            .message { margin: 0.5rem 0 1.75rem; color: #8aa6b1; font-size: 1rem; max-width: 32rem; }
            a.home {
                display: inline-block;
                background: #f5a524;
                color: #08181f;
                font-weight: 700;
                font-size: 0.875rem;
                padding: 0.6rem 1.25rem;
                border-radius: 0.5rem;
                text-decoration: none;
            }
            a.home:hover { opacity: 0.9; }
        </style>
    </head>
    <body>
        <p class="code">{{ $code }}</p>
        <p class="message">{{ $message }}</p>
        <a class="home" href="/">Back to the map</a>
    </body>
</html>
