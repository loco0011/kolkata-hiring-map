import PublicLayout from '@/Layouts/PublicLayout';
import { Head, Link } from '@inertiajs/react';
import { formatPay, logoFor, postedAgo } from '@/lib/format';

export default function CompanyShow({ company }) {
    const jobs = company.live_job_postings ?? [];
    const logo = logoFor(company);

    return (
        <PublicLayout
            title={company.name}
            description={`${jobs.length} live opening${jobs.length === 1 ? '' : 's'} at ${company.name} in Kolkata.`}
        >
            <Head>
                {company.website && (
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                                '@context': 'https://schema.org',
                                '@type': 'Organization',
                                name: company.name,
                                url: company.website,
                                address: company.address,
                            }),
                        }}
                    />
                )}
            </Head>

            <div className="mx-auto max-w-3xl px-4 py-10">
                <Link href={route('map')} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--mute)] hover:text-[var(--text)]">
                    ← Back to map
                </Link>

                <div className="khm-card p-5">
                    <div className="flex items-center gap-4">
                        {logo && (
                            <img
                                src={logo}
                                alt=""
                                className="h-14 w-14 rounded-lg border border-[var(--edge)] bg-white object-contain p-1"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        )}
                        <div>
                            <div className="text-sm text-[var(--mute)]">
                                {[...new Set([company.type, company.sector].filter(Boolean))].join(' · ') || 'Company'}
                            </div>
                            <h1 className="khm-heading text-2xl">
                                {company.name}
                                {company.is_verified && (
                                    <span className="verified-badge" title="Verified by Kolkata Hiring Map">✓</span>
                                )}
                            </h1>
                        </div>
                    </div>

                    <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                    {company.size_band && (
                        <div>
                            <dt className="text-[var(--mute)]">Size</dt>
                            <dd>{company.size_band}</dd>
                        </div>
                    )}
                    {company.funding_stage && (
                        <div>
                            <dt className="text-[var(--mute)]">Stage</dt>
                            <dd>{company.funding_stage}</dd>
                        </div>
                    )}
                    {company.founded_year && (
                        <div>
                            <dt className="text-[var(--mute)]">Founded</dt>
                            <dd>{company.founded_year}</dd>
                        </div>
                    )}
                    {company.address && (
                        <div className="col-span-2 sm:col-span-3">
                            <dt className="text-[var(--mute)]">Address</dt>
                            <dd>{company.address}</dd>
                        </div>
                    )}
                    {company.website && (
                        <div>
                            <dt className="text-[var(--mute)]">Website</dt>
                            <dd>
                                <a href={company.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--marigold)] hover:underline">
                                    Visit ↗︎
                                </a>
                            </dd>
                        </div>
                    )}
                    </dl>
                </div>

                <h2 className="khm-heading mt-10 text-lg">
                    Open roles <span className="text-[var(--mute)]">({jobs.length})</span>
                </h2>

                {jobs.length === 0 ? (
                    <div className="khm-card mt-4 px-5 py-8 text-center text-sm text-[var(--mute)]">
                        No openings listed right now.
                        {company.website && (
                            <div className="mt-3">
                                <a href={company.website} target="_blank" rel="noopener noreferrer" className="ghost">
                                    Check their careers page ↗︎
                                </a>
                            </div>
                        )}
                    </div>
                ) : (
                    <ul className="khm-card mt-4 divide-y divide-[var(--edge)]">
                        {jobs.map((job) => (
                            <li key={job.id} className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="khm-heading text-[15px] font-semibold">{job.title}</div>
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
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </PublicLayout>
    );
}
