import { useState } from 'react';
import { Link, Head, usePage } from '@inertiajs/react';
import ApplicationLogo from '@/Components/ApplicationLogo';
import ThemeToggle from '@/Components/ThemeToggle';

const VIEW_LINKS = [
    { name: 'map', label: 'Map' },
    { name: 'openings.index', label: 'List' },
];

const NAV_LINKS = [
    { name: 'submit', label: 'Add a Listing' },
    { name: 'about', label: 'About' },
];

function ViewToggle({ className = '' }) {
    const activeIndex = VIEW_LINKS.findIndex((link) => route().current(link.name));

    return (
        <div
            className={`relative grid grid-cols-2 items-center rounded-full p-[3px] text-sm ${className}`}
            style={{ background: 'var(--panel)', border: '1px solid var(--edge)' }}
        >
            {/* only draw the pill when one of the views is actually the current page */}
            {activeIndex >= 0 && (
                <span
                    className="absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full transition-transform duration-300 ease-out"
                    style={{
                        background: 'var(--nav-accent)',
                        transform: `translateX(${activeIndex * 100}%)`,
                    }}
                />
            )}
            {VIEW_LINKS.map((link) => {
                const active = route().current(link.name);
                return (
                    <Link
                        key={link.name}
                        href={route(link.name)}
                        className={`relative z-10 rounded-full px-3.5 py-1.5 text-center font-semibold transition-colors duration-300 ${active ? '' : 'hover:!text-[var(--nav-text)]'}`}
                        style={{ color: active ? 'var(--btn-text)' : 'var(--nav-mute)' }}
                    >
                        {link.label}
                    </Link>
                );
            })}
        </div>
    );
}

export default function PublicLayout({ title, description, image, fullHeight = false, children }) {
    const { url } = usePage();
    const [menuOpen, setMenuOpen] = useState(false);

    const fullTitle = title ? `${title} — Kolkata Hiring Map` : 'Kolkata Hiring Map';
    const desc = description ?? 'A live map of who is hiring in Kolkata, where, and at what pay.';
    const canonical = typeof window !== 'undefined' ? `${window.location.origin}${url}` : undefined;

    return (
        <div className={fullHeight ? 'flex h-dvh flex-col overflow-hidden' : 'min-h-screen'}>
            <Head>
                <title>{fullTitle}</title>
                <meta name="description" content={desc} />
                {canonical && <link rel="canonical" href={canonical} />}

                <meta property="og:type" content="website" />
                <meta property="og:title" content={fullTitle} />
                <meta property="og:description" content={desc} />
                {canonical && <meta property="og:url" content={canonical} />}
                {image && <meta property="og:image" content={image} />}

                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content={fullTitle} />
                <meta name="twitter:description" content={desc} />
                {image && <meta name="twitter:image" content={image} />}
            </Head>

            <header
                className="relative z-[1200] flex h-[64px] shrink-0 items-center gap-4 border-b px-4"
                style={{ background: 'var(--top-bg)', backdropFilter: 'blur(10px)', borderColor: 'var(--edge)' }}
            >
                <Link href={route('map')} className="mark">
                    <ApplicationLogo className="mark-logo" aria-hidden="true" />
                    <b>
                        Kolkata <i>Hiring</i> Map
                    </b>
                </Link>

                <ViewToggle className="hidden sm:inline-flex" />

                <span className="flex-1" />

                <nav className="hidden items-center gap-5 text-sm sm:flex" style={{ color: 'var(--nav-mute)' }}>
                    {NAV_LINKS.filter((link) => link.name !== 'submit').map((link) => (
                        <Link
                            key={link.name}
                            href={route(link.name)}
                            className="transition-colors hover:!text-[var(--nav-accent)]"
                            style={
                                route().current(link.name)
                                    ? { color: 'var(--nav-accent)', fontWeight: 700 }
                                    : { color: 'var(--nav-mute)' }
                            }
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <Link href={route('submit')} className="nav-cta hidden sm:inline-flex">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 3v10M3 8h10" />
                    </svg>
                    Add a listing
                </Link>

                <ThemeToggle className="hidden sm:flex" />

                <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="ghost flex h-8 w-8 items-center justify-center !p-0 sm:hidden"
                    aria-label="Toggle menu"
                    aria-expanded={menuOpen}
                >
                    {menuOpen ? '✕' : '☰'}
                </button>

                {menuOpen && (
                    <>
                        <button
                            type="button"
                            aria-label="Close menu"
                            onClick={() => setMenuOpen(false)}
                            className="nav-overlay fixed inset-0 z-[1150] sm:hidden"
                            style={{ background: 'rgba(0,0,0,0.35)', animation: 'navFadeIn 0.18s ease-out' }}
                        />
                        <nav
                            className="nav-dropdown absolute right-3 top-[72px] z-[1200] flex w-[272px] flex-col gap-1 rounded-2xl border p-2.5 text-sm shadow-2xl sm:hidden"
                            style={{
                                background: 'var(--panel)',
                                borderColor: 'var(--edge)',
                                color: 'var(--nav-mute)',
                                animation: 'navDropIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                        >
                            <ViewToggle className="w-full" />

                            <div className="my-1 border-t" style={{ borderColor: 'var(--edge)' }} />

                            {NAV_LINKS.map((link) => {
                                const active = route().current(link.name);
                                return (
                                    <Link
                                        key={link.name}
                                        href={route(link.name)}
                                        onClick={() => setMenuOpen(false)}
                                        className="flex items-center justify-between rounded-xl px-3 py-2.5 font-medium transition-colors"
                                        style={{
                                            color: active ? 'var(--nav-accent)' : 'var(--nav-mute)',
                                            background: active ? 'var(--panel-2)' : 'transparent',
                                        }}
                                    >
                                        {link.label}
                                        {active && (
                                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--nav-accent)' }} />
                                        )}
                                    </Link>
                                );
                            })}

                            <div
                                className="mt-1 flex items-center justify-between rounded-xl border-t px-3 pt-3.5"
                                style={{ borderColor: 'var(--edge)' }}
                            >
                                <span className="font-medium" style={{ color: 'var(--nav-mute)' }}>
                                    Theme
                                </span>
                                <ThemeToggle />
                            </div>
                        </nav>
                    </>
                )}
            </header>

            <main className={fullHeight ? 'relative flex-1 overflow-hidden' : ''}>{children}</main>

            {!fullHeight && (
                <footer
                    className="border-t py-8 text-center text-xs"
                    style={{ borderColor: 'var(--edge)', color: 'var(--mute)' }}
                >
                    Kolkata Hiring Map is a discovery layer, not a job portal. Every listing links out to the original posting.
                </footer>
            )}
        </div>
    );
}
