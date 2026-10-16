import { useId } from 'react';

// The brand mark: an emerald map pin holding Howrah Bridge over the Hooghly.
// Same drawing as public/logo.svg; the favicon is a bolder cut of it.
export default function ApplicationLogo({ title = 'Kolkata Hiring Map', ...props }) {
    const id = `khm${useId().replace(/:/g, '')}`;
    const pin = 'M32 60.5C32 60.5 10.5 41.8 10.5 26.5a21.5 21.5 0 0 1 43 0C53.5 41.8 32 60.5 32 60.5Z';

    return (
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title} {...props}>
            <defs>
                <linearGradient id={`${id}-pin`} x1="18" y1="6" x2="44" y2="60" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#6ef5bd" />
                    <stop offset=".42" stopColor="#22c487" />
                    <stop offset="1" stopColor="#086447" />
                </linearGradient>
                <linearGradient id={`${id}-gloss`} x1="0" y1="5" x2="0" y2="26" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#fff" stopOpacity=".6" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <radialGradient id={`${id}-disk`} cx="32" cy="21" r="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#173d4f" />
                    <stop offset="1" stopColor="#050f15" />
                </radialGradient>
                <linearGradient id={`${id}-steel`} x1="0" y1="15" x2="0" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#ffffff" />
                    <stop offset="1" stopColor="#cdf3e2" />
                </linearGradient>
                <linearGradient id={`${id}-water`} x1="20" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#2ed18b" stopOpacity=".15" />
                    <stop offset=".5" stopColor="#6ef5bd" />
                    <stop offset="1" stopColor="#2ed18b" stopOpacity=".15" />
                </linearGradient>
                <radialGradient
                    id={`${id}-shadow`}
                    cx="32"
                    cy="61.2"
                    r="9"
                    gradientTransform="matrix(1 0 0 .26 0 45.3)"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0" stopColor="#000" stopOpacity=".38" />
                    <stop offset="1" stopColor="#000" stopOpacity="0" />
                </radialGradient>
            </defs>

            <ellipse cx="32" cy="61.2" rx="9" ry="2.3" fill={`url(#${id}-shadow)`} />
            <path d={pin} fill={`url(#${id}-pin)`} />
            <path
                d="M32 59.4C32 59.4 11.6 41.3 11.6 26.5a20.4 20.4 0 0 1 40.8 0C52.4 41.3 32 59.4 32 59.4Z"
                fill="none"
                stroke="#fff"
                strokeOpacity=".22"
                strokeWidth=".7"
            />
            <path d="M12.6 23.5A19.6 19.6 0 0 1 51.4 23.5 19.6 15 0 0 0 12.6 23.5Z" fill={`url(#${id}-gloss)`} />
            <circle cx="32" cy="26.5" r="16.2" fill="#03231a" fillOpacity=".35" />
            <circle cx="32" cy="26.5" r="15.6" fill={`url(#${id}-disk)`} />
            <circle cx="32" cy="26.5" r="14.6" fill="none" stroke="#6ef5bd" strokeOpacity=".35" strokeWidth=".5" />

            <g fill="none" stroke={`url(#${id}-steel)`} strokeLinecap="round" strokeLinejoin="round">
                <path d="M25 16.2v14.8M39 16.2v14.8" strokeWidth="2.3" />
                <path d="M19.2 31 25 20.6l4.5 4.9h5l4.5-4.9 5.8 10.4" strokeWidth="1.7" />
                <path d="M29.5 25.5V31M34.5 25.5V31M21.9 26.2V31M42.1 26.2V31" strokeWidth="1" />
                <path d="M17.6 31.2h28.8" strokeWidth="2.2" />
            </g>
            <circle cx="25" cy="15.4" r="1.15" fill="#fff" />
            <circle cx="39" cy="15.4" r="1.15" fill="#fff" />
            <path
                d="M21.5 35.3q2.6-1.5 5.25 0t5.25 0 5.25 0 5.25 0"
                fill="none"
                stroke={`url(#${id}-water)`}
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path
                d="M25 38.2q1.75-1 3.5 0t3.5 0 3.5 0 3.5 0"
                fill="none"
                stroke={`url(#${id}-water)`}
                strokeWidth="1"
                strokeLinecap="round"
                opacity=".55"
            />
        </svg>
    );
}
