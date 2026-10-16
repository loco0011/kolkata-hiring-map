import PublicLayout from '@/Layouts/PublicLayout';

export default function About() {
    return (
        <PublicLayout title="About" description="What Kolkata Hiring Map is, and what it isn't.">
            <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                <h1 className="khm-heading text-2xl">About Kolkata Hiring Map</h1>

                <p className="mt-4">
                    Kolkata Hiring Map is a public map of hiring activity across Kolkata. It shows who is hiring,
                    where, at what pay, and links out to the original posting. It is a discovery layer, not a job
                    portal.
                </p>

                <p className="mt-4">
                    We never accept applications, host resumes, create candidate accounts, or store candidate
                    personal information. Every role ends in an outbound link to LinkedIn, Naukri, Internshala, or
                    the company's own careers page.
                </p>

                <h2 className="khm-heading mt-8 text-lg">Who this is for</h2>
                <p className="mt-2">
                    Primarily built for a Kolkata fresher or student deciding where to apply. Also useful for
                    experienced developers scanning the market, and for founders and HR teams who want their
                    openings listed.
                </p>

                <h2 className="khm-heading mt-8 text-lg">Freshness</h2>
                <p className="mt-2">
                    A dead link is worse than a missing listing. Every opening here is checked by hand before it goes
                    live, and every night we re-check each posting's link — one that's dead two nights running comes
                    down automatically. Some postings link to a company's general careers page, where a live page
                    doesn't prove that particular role is still open, so if you find one that's gone,<a href={route('submit')} className="underline" style={{ color: 'var(--marigold)' }}>tell us</a> and we'll pull it.
                </p>
            </div>
        </PublicLayout>
    );
}
