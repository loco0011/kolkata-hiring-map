import PublicLayout from '@/Layouts/PublicLayout';
import { Link } from '@inertiajs/react';

export default function AreaShow({ area }) {
    const companies = area.companies ?? [];

    return (
        <PublicLayout
            title={`Companies hiring in ${area.label}`}
            description={`${companies.length} companies with live openings in ${area.label}, Kolkata.`}
        >
            <div className="mx-auto max-w-4xl px-4 py-10">
                <h1 className="khm-heading text-2xl">Companies hiring in {area.label}</h1>
                <p className="mt-1 text-sm text-[var(--mute)]">{companies.length} companies</p>

                {companies.length === 0 ? (
                    <div className="khm-card mt-6 px-5 py-4 text-sm text-[var(--mute)]">
                        No verified companies in {area.label} yet.{' '}
                        <Link href={route('submit')} className="text-[var(--marigold)] hover:underline">
                            Know one? Add it.
                        </Link>
                    </div>
                ) : (
                    <ul className="khm-card mt-6 divide-y divide-[var(--edge)] overflow-hidden">
                        {companies.map((company) => (
                            <li key={company.id}>
                                <Link href={route('company.show', company.slug)} className="khm-link-row flex items-center justify-between gap-4 p-4">
                                    <div>
                                        <div className="font-semibold">{company.name}</div>
                                        <div className="text-sm text-[var(--mute)]">
                                            {[...new Set([company.type, company.sector].filter(Boolean))].join(' · ')}
                                        </div>
                                    </div>
                                    <span className={`tag shrink-0 ${company.live_job_postings_count ? 'f' : ''}`}>
                                        {company.live_job_postings_count} open
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </PublicLayout>
    );
}
