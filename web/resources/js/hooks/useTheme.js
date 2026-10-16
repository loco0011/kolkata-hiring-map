import { useEffect, useState } from 'react';

function readTheme() {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // keep the mobile browser chrome in step with the page
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#ffffff' : '#0B1A22');
    try {
        localStorage.setItem('khm-theme', theme);
    } catch {
        // localStorage unavailable (private mode etc) — theme just won't persist
    }
}

/**
 * Reads the current theme from <html data-theme> and stays in sync via
 * MutationObserver, so components anywhere in the tree can react to a
 * toggle fired elsewhere without needing a shared context provider.
 */
export function useTheme() {
    const [theme, setThemeState] = useState(readTheme);

    useEffect(() => {
        const observer = new MutationObserver(() => setThemeState(readTheme()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    function setTheme(next) {
        applyTheme(next);
    }

    return [theme, setTheme];
}
