import { useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Link, router } from '@inertiajs/react';
import { formatPay, logoFor, postedAgo } from '@/lib/format';

const EXPERIENCE_OPTIONS = ['Intern', 'Fresher', '1-3 yr', '3+ yr'];
const WORK_MODE_OPTIONS = ['onsite', 'hybrid', 'remote'];

export default function OpeningsIndex({ openings, filters }) {
    const jobs = openings.data ?? [];
    const [expandedId, setExpandedId] = useState(null);
    const hasFilters = Boolean(filters.experience || filters.work_mode || filters.internship_only);

    function updateFilter(key, value) {
        router.get(route('openings.index'), { ...filters, [key]: value || undefined }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    }

    function clearFilters() {
        router.get(route('openings.index'), {}, { preserveState: true, preserveScroll: true, replace: true });
    }

    function toggleExpanded(jobId) {
        setExpandedId((current) => (current === jobId ? null : jobId));
    }

    return (
        <PublicLayout title="Openings" description="All live openings across Kolkata companies, newest first.">
            <div className="mx-auto max-w-4xl px-4 py-10">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="khm-heading text-2xl">Live openings</h1>
                        <p className="mt-1 text-sm text-[var(--mute)]">
                            {openings.total} opening{openings.total === 1 ? '' : 's'} across Kolkata, newest first
                        </p>
                    </div>
                    <Link href={route('map')} className="ghost">
                        View on map
                    </Link>
                </div>

                <div className="khm-card mt-6 flex flex-wrap items-center gap-2 p-3">
                    <select
                        value={filters.experience ?? ''}
                        onChange={(e) => updateFilter('experience', e.target.value)}
                        className={`khm-select ${filters.experience ? 'set' : ''}`}
                        aria-label="Experience"
                    >
                        <option value="">All experience</option>
                        {EXPERIENCE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>

                    <select
                        value={filters.work_mode ?? ''}
                        onChange={(e) => updateFilter('work_mode', e.target.value)}
                        className={`khm-select capitalize ${filters.work_mode ? 'set' : ''}`}
                        aria-label="Work mode"
                    >
                        <option value="">All work modes</option>
                        {WORK_MODE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>

                    <button
                        type="button"
                        data-k="intern"
                        aria-pressed={!!filters.internship_only}
                        onClick={() => updateFilter('internship_only', filters.internship_only ? '' : '1')}
                        className={`chip ${filters.internship_only ? 'on' : ''}`}
                    >
                        <span className="dot" aria-hidden="true" />
                        Internships only
                    </button>

                    {hasFilters && (
                        <button type="button" onClick={clearFilters} className="chip ml-auto">
                            Clear filters
                        </button>
                    )}
                </div>

                {jobs.length === 0 ? (
                    <div className="khm-card mt-6 px-5 py-10 text-center text-sm text-[var(--mute)]">
                        No openings match these filters.
                        {hasFilters && (
                            <div className="mt-3">
                                <button type="button" onClick={clearFilters} className="ghost">
                                    Clear filters
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <ul className="khm-card mt-6 divide-y divide-[var(--edge)] overflow-hidden">
                        {jobs.map((job) => {
                            const isExpanded = expandedId === job.id;
                            const company = job.company;
                            const logo = logoFor(company);

                            return (
                                <li key={job.id} className="p-4 transition-colors hover:bg-[var(--panel-2)]">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => toggleExpanded(job.id)}
                                                className="flex items-center gap-1 rounded text-sm text-[var(--mute)] hover:text-[var(--text)]"
                                                aria-expanded={isExpanded}
                                            >
                                                <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                                                {company.name}
                                            </button>
                                            <div className="khm-heading mt-0.5 text-[15px] font-semibold">{job.title}</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {job.is_internship && <span className="tag i">Internship</span>}
                                                {job.exp_bucket && <span className="tag">{job.exp_bucket}</span>}
                                                {job.work_mode && <span className="tag capitalize">{job.work_mode}</span>}
                                                <span className="tag pay">{formatPay(job)}</span>
                                            </div>
                                            {job.posted_at && (
                                                <div className="mt-2 text-xs text-[var(--mute)]">Posted {postedAgo(job.posted_at)}</div>
                                            )}
                                        </div>
                                        <a
                                            href={job.apply_url}
                                            target="_blank"
                                            rel="noopener noreferrer nofollow"
                                            className="khm-btn shrink-0"
                                        >
                                            Apply <span className="arr" aria-hidden="true">↗︎</span>
                                        </a>
                                    </div>

                                    {isExpanded && (
                                        <div className="mt-3 flex gap-3 rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--edge)' }}>
                                            {logo && (
                                                <img
                                                    src={logo}
                                                    alt=""
                                                    className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1"
                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                />
                                            )}
                                            <div className="min-w-0 flex-1 text-sm">
                                                <div className="text-[var(--mute)]">
                                                    {[...new Set([company.type, company.sector, company.size_band].filter(Boolean))].join(' · ')}
                                                </div>
                                                {company.address && <div className="mt-1">{company.address}</div>}
                                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold">
                                                    {company.website && (
                                                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[var(--marigold)] hover:underline">
                                                            Website ↗︎
                                                        </a>
                                                    )}
                                                    <Link href={route('company.show', company.slug)} className="text-[var(--marigold)] hover:underline">
                                                        View full company page →
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                {openings.last_page > 1 && (
                    <nav className="mt-6 flex flex-wrap justify-center gap-1.5 text-sm" aria-label="Pagination">
                        {openings.links.map((link, i) => (
                            <Link
                                key={i}
                                href={link.url ?? '#'}
                                preserveScroll
                                aria-current={link.active ? 'page' : undefined}
                                className={`rounded-lg px-3 py-1.5 ${link.active ? 'khm-btn' : 'ghost !py-1.5'} ${!link.url ? 'pointer-events-none opacity-30' : ''}`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </nav>
                )}
            </div>
        </PublicLayout>
    );
}
