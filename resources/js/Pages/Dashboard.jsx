import { useRef, useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { postedAgo } from '@/lib/format';

function Stat({ label, value, tone }) {
    return (
        <div className="khm-card px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mute)]">{label}</div>
            <div className="khm-heading mt-1 text-2xl" style={tone ? { color: `var(--${tone})` } : undefined}>
                {value}
            </div>
        </div>
    );
}

function Field({ label, error, children, className = '' }) {
    return (
        <label className={`block text-sm ${className}`}>
            <span className="font-semibold text-[var(--text)]">{label}</span>
            {children}
            {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
        </label>
    );
}

const inputCls = 'q mt-1 w-full';

// Job board links the Python fetcher can read → { provider, token }.
// Keep in sync with Company::ATS_PROVIDERS and fetcher/ingest/sources/.
const BOARD_PATTERNS = [
    ['greenhouse', /^(?:job-)?boards(?:-api)?\.greenhouse\.io$/, (path) => path[0] === 'v1' ? path[2] : path[0]],
    // jobs.eu.lever.co boards use a different API host the fetcher doesn't call — not detected on purpose
    ['lever', /^jobs\.lever\.co$/, (path) => path[0]],
    ['ashby', /^jobs\.ashbyhq\.com$/, (path) => path[0]],
    ['workable', /^apply\.workable\.com$/, (path) => path[0]],
];

const SUBDOMAIN_BOARDS = [
    ['recruitee', 'recruitee.com'],
    ['freshteam', 'freshteam.com'],
    ['darwinbox', 'darwinbox.in'],
    ['keka', 'keka.com'],
];

function parseBoardUrl(value) {
    let url;
    try {
        url = new URL(value.trim());
    } catch {
        return null;
    }
    const host = url.hostname.toLowerCase();
    const path = url.pathname.split('/').filter(Boolean);
    // providers whose token is the company's subdomain
    for (const [provider, suffix] of SUBDOMAIN_BOARDS) {
        const m = host.match(new RegExp(`^([a-z0-9-]+)\\.${suffix.replace(/\./g, '\\.')}$`));
        if (m) return { provider, token: m[1] };
    }
    // Zoho Recruit: the whole host, since acme.zohorecruit.in and .com can be different orgs
    if (/^[a-z0-9][a-z0-9-]*\.zohorecruit\.(com|in|eu|com\.au|jp)$/.test(host)) return { provider: 'zohorecruit', token: host };
    for (const [provider, hostRe, pick] of BOARD_PATTERNS) {
        if (hostRe.test(host)) {
            const token = pick(path);
            return token ? { provider, token } : null;
        }
    }
    return null;
}

function JobSourceFields({ data, setData, errors, options }) {
    const [pasted, setPasted] = useState('');
    const detected = pasted ? parseBoardUrl(pasted) : null;

    function onPaste(value) {
        setPasted(value);
        const found = value ? parseBoardUrl(value) : null;
        if (found) {
            setData((d) => ({ ...d, ats_provider: found.provider, ats_token: found.token }));
        }
    }

    return (
        <>
            <Field label="Job board link" className="sm:col-span-2">
                {/* plain text, not type=url: it's only a helper and must never block the form's submit */}
                <input
                    className={inputCls}
                    inputMode="url"
                    placeholder="Paste e.g. https://acme.keka.com/careers to fill provider + token"
                    value={pasted}
                    onChange={(e) => onPaste(e.target.value)}
                />
                {pasted && (
                    <span className="mt-1 block text-xs" style={{ color: detected ? 'var(--live)' : 'var(--mute)' }}>
                        {detected
                            ? `✓ Detected ${detected.provider} board “${detected.token}”`
                            : `Not a supported job board link (${options.atsProviders.join(', ')}) — use the careers page field instead.`}
                    </span>
                )}
            </Field>
            <Field label="Job board provider" error={errors.ats_provider}>
                <select className={inputCls} value={data.ats_provider} onChange={(e) => setData('ats_provider', e.target.value)}>
                    <option value="">None</option>
                    {options.atsProviders.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
            </Field>
            <Field label="Board token" error={errors.ats_token}>
                <input className={inputCls} placeholder={data.ats_provider === 'zohorecruit' ? 'acme.zohorecruit.in' : 'the slug in the board URL'} value={data.ats_token} onChange={(e) => setData('ats_token', e.target.value.trim())} />
            </Field>
            <Field label="Careers page" error={errors.careers_url} className="sm:col-span-2">
                <input className={inputCls} type="url" placeholder="https://company.com/careers" value={data.careers_url} onChange={(e) => setData('careers_url', e.target.value)} />
                <span className="mt-1 block text-xs text-[var(--mute)]">
                    Used when there's no job board: the fetcher reads job listings embedded in the page (schema.org JobPosting). Many pages have none — a board is more reliable.
                </span>
            </Field>
        </>
    );
}

function SourcesForm({ companies, options }) {
    const [companyId, setCompanyId] = useState('');
    const company = companies.find((c) => c.id === companyId);
    const configured = companies.filter((c) => (c.ats_provider && c.ats_token) || c.careers_url).length;

    return (
        <div>
            <p className="mb-4 text-sm text-[var(--mute)]">
                Where the nightly job fetcher looks for each company's openings. {configured} of {companies.length} companies have a source.
            </p>
            <Field label="Company">
                <select className={inputCls} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                    <option value="">Choose…</option>
                    {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                            {c.ats_provider ? ` · ${c.ats_provider}` : c.careers_url ? ' · careers page' : ' · no source'}
                        </option>
                    ))}
                </select>
            </Field>
            {/* keyed on the saved values so the form resets to them after a save */}
            {company && (
                <SourcesEditor
                    key={[company.id, company.ats_provider, company.ats_token, company.careers_url].join('|')}
                    company={company}
                    options={options}
                />
            )}
        </div>
    );
}

function SourcesEditor({ company, options }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        careers_url: company.careers_url ?? '',
        ats_provider: company.ats_provider ?? '',
        ats_token: company.ats_token ?? '',
    });

    function submit(e) {
        e.preventDefault();
        patch(route('admin.companies.sources', company.id), { preserveScroll: true });
    }

    return (
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <JobSourceFields data={data} setData={setData} errors={errors} options={options} />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="submit" disabled={processing || !isDirty} className="khm-btn disabled:opacity-60">
                    {processing && <span className="khm-spinner" aria-hidden="true" />}
                    Save sources
                </button>
                {(data.ats_provider || data.ats_token) && (
                    <button type="button" className="ghost" onClick={() => setData((d) => ({ ...d, ats_provider: '', ats_token: '' }))}>
                        Remove job board
                    </button>
                )}
            </div>
        </form>
    );
}

function CompanyForm({ areas, options, prefill, onDone }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: prefill?.name ?? '',
        area: '',
        address: '',
        website: prefill?.website ?? '',
        type: '',
        sector: '',
        lat: '',
        lng: '',
        is_verified: true,
        careers_url: '',
        ats_provider: '',
        ats_token: '',
        submission_id: prefill?.submission_id ?? null,
    });

    function submit(e) {
        e.preventDefault();
        post(route('admin.companies.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onDone?.();
            },
        });
    }

    return (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" error={errors.name}>
                <input className={inputCls} value={data.name} onChange={(e) => setData('name', e.target.value)} />
            </Field>
            <Field label="Area *" error={errors.area}>
                <select className={inputCls} value={data.area} onChange={(e) => setData('area', e.target.value)}>
                    <option value="">Choose…</option>
                    {areas.map((a) => (
                        <option key={a.key} value={a.key}>{a.label}</option>
                    ))}
                </select>
            </Field>
            <Field label="Website" error={errors.website}>
                <input className={inputCls} type="url" placeholder="https://" value={data.website} onChange={(e) => setData('website', e.target.value)} />
            </Field>
            <Field label="Address" error={errors.address}>
                <input className={inputCls} value={data.address} onChange={(e) => setData('address', e.target.value)} />
            </Field>
            <Field label="Type" error={errors.type}>
                <select className={inputCls} value={data.type} onChange={(e) => setData('type', e.target.value)}>
                    <option value="">—</option>
                    {options.types.map((t) => <option key={t}>{t}</option>)}
                </select>
            </Field>
            <Field label="Sector" error={errors.sector}>
                <select className={inputCls} value={data.sector} onChange={(e) => setData('sector', e.target.value)}>
                    <option value="">—</option>
                    {options.sectors.map((s) => <option key={s}>{s}</option>)}
                </select>
            </Field>
            <Field label="Latitude" error={errors.lat}>
                <input className={inputCls} inputMode="decimal" placeholder="blank = area centre" value={data.lat} onChange={(e) => setData('lat', e.target.value)} />
            </Field>
            <Field label="Longitude" error={errors.lng}>
                <input className={inputCls} inputMode="decimal" placeholder="blank = area centre" value={data.lng} onChange={(e) => setData('lng', e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="rounded" checked={data.is_verified} onChange={(e) => setData('is_verified', e.target.checked)} />
                I've confirmed this company is real and based in Kolkata (shows the ✓ badge)
            </label>
            <h3 className="khm-heading mt-2 text-sm sm:col-span-2">Job sources <span className="font-normal text-[var(--mute)]">— optional, for the nightly fetcher</span></h3>
            <JobSourceFields data={data} setData={setData} errors={errors} options={options} />
            <div className="sm:col-span-2">
                <button type="submit" disabled={processing} className="khm-btn disabled:opacity-60">
                    {processing && <span className="khm-spinner" aria-hidden="true" />}
                    Add company
                </button>
            </div>
        </form>
    );
}

function PostingForm({ companies, options, prefill, onDone }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        company_id: prefill?.company_id ?? '',
        title: prefill?.title ?? '',
        exp_bucket: prefill?.exp_bucket ?? '',
        work_mode: prefill?.work_mode ?? '',
        is_internship: false,
        is_fresher_ok: false,
        source: prefill?.source ?? 'careers',
        source_label: '',
        apply_url: prefill?.apply_url ?? '',
        pay_min: '',
        pay_max: '',
        pay_period: '',
        posted_at: prefill?.posted_at ?? '',
        submission_id: prefill?.submission_id ?? null,
    });

    function submit(e) {
        e.preventDefault();
        post(route('admin.postings.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onDone?.();
            },
        });
    }

    return (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Company *" error={errors.company_id}>
                <select className={inputCls} value={data.company_id} onChange={(e) => setData('company_id', e.target.value)}>
                    <option value="">Choose…</option>
                    {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </Field>
            <Field label="Title *" error={errors.title}>
                <input className={inputCls} value={data.title} onChange={(e) => setData('title', e.target.value)} />
            </Field>
            <Field label="Apply URL * (the actual posting)" error={errors.apply_url} className="sm:col-span-2">
                <input className={inputCls} type="url" placeholder="https://" value={data.apply_url} onChange={(e) => setData('apply_url', e.target.value)} />
            </Field>
            <Field label="Source *" error={errors.source}>
                <select className={inputCls} value={data.source} onChange={(e) => setData('source', e.target.value)}>
                    {options.sources.map((s) => <option key={s}>{s}</option>)}
                </select>
            </Field>
            <Field label="Source label" error={errors.source_label}>
                <input className={inputCls} placeholder="e.g. Careers page" value={data.source_label} onChange={(e) => setData('source_label', e.target.value)} />
            </Field>
            <Field label="Experience" error={errors.exp_bucket}>
                <select className={inputCls} value={data.exp_bucket} onChange={(e) => setData('exp_bucket', e.target.value)}>
                    <option value="">—</option>
                    {options.expBuckets.map((b) => <option key={b}>{b}</option>)}
                </select>
            </Field>
            <Field label="Work mode" error={errors.work_mode}>
                <select className={inputCls} value={data.work_mode} onChange={(e) => setData('work_mode', e.target.value)}>
                    <option value="">—</option>
                    {options.workModes.map((m) => <option key={m}>{m}</option>)}
                </select>
            </Field>
            <Field label="Pay min (₹)" error={errors.pay_min}>
                <input className={inputCls} inputMode="numeric" value={data.pay_min} onChange={(e) => setData('pay_min', e.target.value)} />
            </Field>
            <Field label="Pay max (₹)" error={errors.pay_max}>
                <input className={inputCls} inputMode="numeric" value={data.pay_max} onChange={(e) => setData('pay_max', e.target.value)} />
            </Field>
            <Field label="Pay period" error={errors.pay_period}>
                <select className={inputCls} value={data.pay_period} onChange={(e) => setData('pay_period', e.target.value)}>
                    <option value="">—</option>
                    <option value="annual">annual</option>
                    <option value="monthly">monthly</option>
                </select>
            </Field>
            <Field label="Posted on" error={errors.posted_at}>
                <input className={inputCls} type="date" value={data.posted_at} onChange={(e) => setData('posted_at', e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-5 text-sm sm:col-span-2">
                <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" checked={data.is_internship} onChange={(e) => setData('is_internship', e.target.checked)} />
                    Internship
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" checked={data.is_fresher_ok} onChange={(e) => setData('is_fresher_ok', e.target.checked)} />
                    Open to freshers
                </label>
            </div>
            <div className="sm:col-span-2">
                <button type="submit" disabled={processing} className="khm-btn disabled:opacity-60">
                    {processing && <span className="khm-spinner" aria-hidden="true" />}
                    Add opening
                </button>
            </div>
        </form>
    );
}

export default function Dashboard({ submissions, stats, needsAttention, lastCheckRun, companies, areas, options }) {
    const { props } = usePage();
    const formsRef = useRef(null);
    const [tab, setTab] = useState('posting');
    // bumping the key remounts the form so it picks up new prefill values
    const [prefill, setPrefill] = useState({ key: 0, data: null });

    function fillFromSubmission(s) {
        const p = s.payload ?? {};
        if (s.kind === 'company') {
            setTab('company');
            setPrefill((cur) => ({ key: cur.key + 1, data: { name: p.company_name, submission_id: s.id } }));
        } else {
            const match = companies.find((c) => c.name.toLowerCase() === (p.company_name ?? '').trim().toLowerCase());
            const bucket = options.expBuckets.find((b) => b.toLowerCase() === (p.experience ?? '').trim().toLowerCase());
            setTab('posting');
            setPrefill((cur) => ({
                key: cur.key + 1,
                data: {
                    company_id: match?.id ?? '',
                    title: p.role,
                    apply_url: p.source_url,
                    exp_bucket: bucket ?? '',
                    submission_id: s.id,
                    // jobs found by the Python fetcher carry a bit more structure
                    ...(p.origin === 'fetcher' && {
                        source: p.provider === 'jsonld' ? 'careers' : 'ats',
                        work_mode: p.work_mode ?? '',
                        posted_at: p.posted_at?.slice(0, 10) ?? '',
                    }),
                },
            }));
        }
        formsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function review(s, status) {
        router.patch(route('admin.submissions.review', s.id), { status }, { preserveScroll: true });
    }

    function postingAction(job, action) {
        router.patch(route(`admin.postings.${action}`, job.id), {}, { preserveScroll: true });
    }

    const clearPrefill = () => setPrefill((cur) => ({ key: cur.key + 1, data: null }));

    return (
        <PublicLayout title="Dashboard">
            <div className="mx-auto max-w-5xl px-4 py-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="khm-heading text-2xl">Moderation</h1>
                    <div className="flex gap-2">
                        <Link href={route('profile.edit')} className="ghost">Account</Link>
                        <Link href={route('logout')} method="post" as="button" className="ghost">Log out</Link>
                    </div>
                </div>

                {props.flash?.success && (
                    <div
                        role="status"
                        className="mt-4 rounded-lg border px-4 py-3 text-sm font-semibold"
                        style={{ borderColor: 'var(--live)', background: 'var(--tag-f-bg)', color: 'var(--live)' }}
                    >
                        ✓ {props.flash.success}
                    </div>
                )}

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Pending submissions" value={stats.pending} tone={stats.pending ? 'marigold' : null} />
                    <Stat label="Live postings" value={stats.livePostings} tone="live" />
                    <Stat label="Need attention" value={stats.needsAttention} tone={stats.needsAttention ? 'intern' : null} />
                    <Stat label="Companies" value={stats.companies} />
                </div>

                <p className="mt-3 text-xs text-[var(--mute)]">
                    {lastCheckRun
                        ? `Last link check ${postedAgo(lastCheckRun.started_at)}: ${lastCheckRun.jobs_found} checked, ${lastCheckRun.jobs_closed} closed.`
                        : 'The nightly link check has never run — make sure the scheduler cron is set up (see DEPLOY.md), or run `php artisan postings:check`.'}
                </p>

                {/* ---------- submissions ---------- */}
                <h2 className="khm-heading mt-10 text-lg">Pending submissions</h2>
                {submissions.length === 0 ? (
                    <div className="khm-card mt-3 px-5 py-6 text-center text-sm text-[var(--mute)]">Nothing waiting for review.</div>
                ) : (
                    <ul className="khm-card mt-3 divide-y divide-[var(--edge)]">
                        {submissions.map((s) => {
                            const p = s.payload ?? {};
                            return (
                                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                                    <div className="min-w-0 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className={`tag ${s.kind === 'job' ? 'f' : ''}`}>{s.kind}</span>
                                            <span className="font-semibold">{p.company_name}</span>
                                            {p.role && <span className="text-[var(--mute)]">— {p.role}</span>}
                                            {p.origin === 'fetcher' && <span className="tag" title="Found automatically by the job fetcher">auto · {p.provider}</span>}
                                        </div>
                                        <div className="mt-1 text-xs text-[var(--mute)]">
                                            {[p.experience, p.pay, p.location, `${p.origin === 'fetcher' ? 'found' : 'submitted'} ${postedAgo(s.created_at)}`].filter(Boolean).join(' · ')}
                                        </div>
                                        <a href={p.source_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block truncate text-xs font-semibold text-[var(--marigold)] hover:underline">
                                            {p.source_url} ↗︎
                                        </a>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        <button type="button" className="khm-btn" onClick={() => fillFromSubmission(s)}>
                                            Add as {s.kind === 'job' ? 'opening' : 'company'}
                                        </button>
                                        <button type="button" className="ghost" onClick={() => review(s, 'approved')} title="Mark as handled without adding anything">
                                            Mark done
                                        </button>
                                        <button type="button" className="ghost" onClick={() => review(s, 'rejected')}>
                                            Reject
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {/* ---------- postings needing attention ---------- */}
                <h2 className="khm-heading mt-10 text-lg">Postings needing attention</h2>
                <p className="mt-1 text-xs text-[var(--mute)]">
                    Link check failed, or not confirmed live in 14+ days. After 21 days unconfirmed a posting is hidden from the site until you confirm it.
                </p>
                {needsAttention.length === 0 ? (
                    <div className="khm-card mt-3 px-5 py-6 text-center text-sm text-[var(--mute)]">All postings are healthy.</div>
                ) : (
                    <ul className="khm-card mt-3 divide-y divide-[var(--edge)]">
                        {needsAttention.map((job) => (
                            <li key={job.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                                <div className="min-w-0 text-sm">
                                    <div className="font-semibold">{job.title}</div>
                                    <div className="text-xs text-[var(--mute)]">{job.company?.name}</div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {job.hidden && <span className="tag i">Hidden from site</span>}
                                        {job.check_failures > 0 && <span className="tag i">Dead link ×{job.check_failures}</span>}
                                        <span className="tag">Confirmed {job.last_seen_days}d ago</span>
                                    </div>
                                    <a href={job.apply_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 block truncate text-xs font-semibold text-[var(--marigold)] hover:underline">
                                        Open link to check ↗︎
                                    </a>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button type="button" className="khm-btn" onClick={() => postingAction(job, 'confirm')}>
                                        Still live
                                    </button>
                                    <button type="button" className="ghost" onClick={() => postingAction(job, 'close')}>
                                        Close
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {/* ---------- add forms ---------- */}
                <div ref={formsRef} className="scroll-mt-4">
                    <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="khm-heading text-lg">Add to the map</h2>
                        <div className="seg w-full sm:w-96">
                            <button type="button" className={tab === 'posting' ? 'on' : ''} onClick={() => setTab('posting')}>Opening</button>
                            <button type="button" className={tab === 'company' ? 'on' : ''} onClick={() => setTab('company')}>Company</button>
                            <button type="button" className={tab === 'sources' ? 'on' : ''} onClick={() => setTab('sources')}>Job sources</button>
                        </div>
                    </div>

                    <div className="khm-card mt-3 p-5">
                        {prefill.data?.submission_id && tab !== 'sources' && (
                            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--tag-pay-bg)', color: 'var(--marigold)' }}>
                                <span>Prefilled from a submission — it'll be marked approved when you save. Verify every field against the source first.</span>
                                <button type="button" className="font-bold underline" onClick={clearPrefill}>Clear</button>
                            </div>
                        )}
                        {tab === 'sources' ? (
                            <SourcesForm companies={companies} options={options} />
                        ) : tab === 'posting' ? (
                            <>
                                {companies.length === 0 && (
                                    <p className="mb-4 text-sm text-[var(--mute)]">Add a company first.</p>
                                )}
                                <PostingForm key={`p${prefill.key}`} companies={companies} options={options} prefill={prefill.data} onDone={clearPrefill} />
                            </>
                        ) : (
                            <CompanyForm key={`c${prefill.key}`} areas={areas} options={options} prefill={prefill.data} onDone={clearPrefill} />
                        )}
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}
