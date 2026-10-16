import { Link } from '@inertiajs/react';

export default function GuestLayout({ children }) {
    return (
        <div className="flex min-h-screen flex-col items-center bg-neutral-950 pt-6 sm:justify-center sm:pt-0">
            <div>
                <Link href="/" className="text-sm font-semibold tracking-tight text-neutral-100">
                    Kolkata Hiring Map
                </Link>
            </div>

            <div className="mt-6 w-full overflow-hidden bg-white px-6 py-4 shadow-md sm:max-w-md sm:rounded-lg">
                {children}
            </div>
        </div>
    );
}
