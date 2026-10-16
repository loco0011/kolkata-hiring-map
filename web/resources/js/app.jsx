import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

// The Docker build has no .env, so VITE_APP_NAME is unset there
const appName = import.meta.env.VITE_APP_NAME || 'Kolkata Hiring Map';

createInertiaApp({
    // PublicLayout already builds "Page — Kolkata Hiring Map"; only suffix bare titles (auth pages)
    title: (title) => (!title ? appName : title.includes(appName) ? title : `${title} — ${appName}`),
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#F5A524',
    },
});
