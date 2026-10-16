import PublicLayout from '@/Layouts/PublicLayout';
import { useForm, usePage } from '@inertiajs/react';

const KINDS = [
    { value: 'company', label: 'A company' },
    { value: 'job', label: 'A job opening' },
];

function Field({ id, label, hint, required, error, children }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-semibold text-[var(--text)]">
                {label}
                {required ? (
                    <span className="ml-0.5 text-[var(--marigold)]" aria-hidden="true">*</span>
                ) : (
                    <span className="ml-1.5 text-xs font-normal text-[var(--mute)]">optional</span>
                )}
            </label>
            {children}
            {hint && !error && <p className="mt-1 text-xs text-[var(--mute)]">{hint}</p>}
            {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
    );
}

export default function Submit() {
    const { props } = usePage();
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        kind: 'company',
        company_name: '',
        role: '',
        experience: '',
        pay: '',
        source_url: '',
        email: '',
        website: '', // honeypot — real users never fill this; left blank and hidden from view
    });

    function submit(e) {
        e.preventDefault();
        post(route('submit.store'), { preserveScroll: true, onSuccess: () => reset() });
    }

    function input(name, props = {}) {
        return {
            id: name,
            name,
            value: data[name],
            onChange: (e) => setData(name, e.target.value),
            className: 'q mt-1.5 w-full',
            'aria-invalid': errors[name] ? true : undefined,
            'aria-describedby': errors[name] ? `${name}-error` : undefined,
            ...props,
        };
    }

    return (
        <PublicLayout title="Submit" description="Add a company or an opening to the Kolkata Hiring Map.">
            <div className="mx-auto max-w-lg px-4 py-10">
                <h1 className="khm-heading text-2xl">Add a company or opening</h1>
                <p className="mt-1 text-sm text-[var(--mute)]">
                    Free, always. We review submissions before they go live.
                </p>

                {props.flash?.success && (
                    <div
                        role="status"
                        className="mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold"
                        style={{ borderColor: 'var(--live)', background: 'var(--tag-f-bg)', color: 'var(--live)' }}
                    >
                        <span aria-hidden="true">✓</span>
                        {props.flash.success}
                    </div>
                )}

                <form onSubmit={submit} className="khm-card mt-6 space-y-5 p-5" noValidate>
                    <input
                        type="text"
                        name="website"
                        value={data.website}
                        onChange={(e) => setData('website', e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="absolute left-[-9999px] h-0 w-0 opacity-0"
                    />

                    <div>
                        <span className="block text-sm font-semibold text-[var(--text)]">What are you submitting?</span>
                        <div className="seg mt-1.5" role="radiogroup" aria-label="What are you submitting?">
                            {KINDS.map((kind) => (
                                <button
                                    key={kind.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={data.kind === kind.value}
                                    className={data.kind === kind.value ? 'on' : ''}
                                    onClick={() => {
                                        setData('kind', kind.value);
                                        clearErrors('role');
                                    }}
                                >
                                    {kind.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Field id="company_name" label="Company name" required error={errors.company_name}>
                        <input type="text" autoComplete="organization" {...input('company_name')} />
                    </Field>

                    {data.kind === 'job' && (
                        <>
                            <Field id="role" label="Role" required error={errors.role}>
                                <input type="text" placeholder="e.g. Backend Developer Intern" {...input('role')} />
                            </Field>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field id="experience" label="Experience" error={errors.experience}>
                                    <input type="text" placeholder="e.g. Fresher, 1-3 yr" {...input('experience')} />
                                </Field>
                                <Field id="pay" label="Pay" error={errors.pay}>
                                    <input type="text" placeholder="e.g. ₹15k/mo, 4-6 LPA" {...input('pay')} />
                                </Field>
                            </div>
                        </>
                    )}

                    <Field
                        id="source_url"
                        label="Source URL"
                        required
                        hint="LinkedIn, Naukri, Internshala, or the company's careers page."
                        error={errors.source_url}
                    >
                        <input type="url" inputMode="url" placeholder="https://" {...input('source_url')} />
                    </Field>

                    <Field
                        id="email"
                        label="Your email"
                        hint="We keep only a one-way hash of it, never the address itself."
                        error={errors.email}
                    >
                        <input type="email" autoComplete="email" {...input('email')} />
                    </Field>

                    <button type="submit" disabled={processing} className="khm-btn w-full !py-2.5 disabled:opacity-60">
                        {processing && <span className="khm-spinner" aria-hidden="true" />}
                        {processing ? 'Submitting…' : 'Submit for review'}
                    </button>
                </form>
            </div>
        </PublicLayout>
    );
}
