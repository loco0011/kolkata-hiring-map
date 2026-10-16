import { useTheme } from '@/hooks/useTheme';

export default function ThemeToggle({ className = '' }) {
    const [theme, setTheme] = useTheme();
    const isDark = theme === 'dark';
    const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`ghost flex h-8 w-8 items-center justify-center !p-0 ${className}`}
            aria-label={label}
            title={label}
        >
            <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ color: isDark ? 'var(--marigold)' : 'var(--text)' }}
            >
                {isDark ? (
                    <>
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                    </>
                ) : (
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                )}
            </svg>
        </button>
    );
}
