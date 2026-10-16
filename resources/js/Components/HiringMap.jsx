import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { useTheme } from '@/hooks/useTheme';
import { logoFor } from '@/lib/format';

const KOLKATA_CENTER = [22.558, 88.415];
const DEFAULT_ZOOM = 12;

function toLPA(n) {
    return (n / 100000).toFixed(1).replace(/\.0$/, '');
}

function formatPay(job) {
    if (!job.pay_is_disclosed || (!job.pay_min && !job.pay_max)) return 'Not disclosed';

    if (job.pay_period === 'monthly') {
        const fmt = (n) => `₹${Math.round(n / 1000)}k/mo`;
        return job.pay_min && job.pay_max && job.pay_min !== job.pay_max
            ? `${fmt(job.pay_min)}–${fmt(job.pay_max)}`
            : fmt(job.pay_min ?? job.pay_max);
    }

    return job.pay_min && job.pay_max && job.pay_min !== job.pay_max
        ? `₹${toLPA(job.pay_min)}–${toLPA(job.pay_max)} LPA`
        : `₹${toLPA(job.pay_min ?? job.pay_max)} LPA`;
}

function ago(d) {
    if (d == null) return '';
    if (d === 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 7) return `${d} days ago`;
    if (d < 14) return '1 week ago';
    return `${Math.floor(d / 7)} weeks ago`;
}

const CHIPS = [
    { key: 'intern', label: 'Internships' },
    { key: 'fresher', label: 'Open to freshers' },
    { key: 'fresh7', label: 'Posted this week' },
];

const EMPTY_FILTERS = { q: '', area: '', sector: '', type: '', exp: '', intern: false, fresher: false, fresh7: false };

export default function HiringMap({ companies, areas, sectors, types, experienceBuckets }) {
    const mapEl = useRef(null);
    const mapRef = useRef(null);
    const clusterRef = useRef(null);
    const tileLayerRef = useRef(null);
    const labelLayerRef = useRef(null);
    const [theme] = useTheme();
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [selectedId, setSelectedId] = useState(null);
    const [railOpenMobile, setRailOpenMobile] = useState(false);

    const q = filters.q.trim().toLowerCase();

    const activeFilterCount =
        [filters.q.trim(), filters.area, filters.sector, filters.type, filters.exp].filter(Boolean).length +
        [filters.intern, filters.fresher, filters.fresh7].filter(Boolean).length;

    const jobsOf = useMemo(() => {
        const jobOk = (job) => {
            if (filters.intern && !job.is_internship) return false;
            if (filters.fresher && !job.is_fresher_ok) return false;
            if (filters.fresh7 && (job.days_ago == null || job.days_ago > 7)) return false;
            if (filters.exp && job.exp_bucket !== filters.exp) return false;
            return true;
        };

        return (company) => {
            // A search that matches the company itself (name/sector/type) keeps all its
            // jobs; otherwise the search has to match the individual job title.
            const companyHit =
                q &&
                [company.name, company.sector, company.type].some((v) => (v ?? '').toLowerCase().includes(q));

            return company.jobs.filter(
                (job) => jobOk(job) && (!q || companyHit || job.title.toLowerCase().includes(q)),
            );
        };
    }, [filters, q]);

    const companyOk = useMemo(() => {
        const anyFilter = q || filters.intern || filters.fresher || filters.fresh7 || filters.exp;

        return (company) => {
            if (filters.area && company.area !== filters.area) return false;
            if (filters.sector && company.sector !== filters.sector) return false;
            if (filters.type && company.type !== filters.type) return false;
            return anyFilter ? jobsOf(company).length > 0 : true;
        };
    }, [filters, q, jobsOf]);

    const visibleCompanies = useMemo(() => companies.filter(companyOk), [companies, companyOk]);

    const { totalJobs, totalInterns } = useMemo(() => {
        let total = 0;
        let interns = 0;
        visibleCompanies.forEach((c) => {
            const js = jobsOf(c);
            total += js.length;
            interns += js.filter((j) => j.is_internship).length;
        });
        return { totalJobs: total, totalInterns: interns };
    }, [visibleCompanies, jobsOf]);

    const railRows = useMemo(() => {
        const rows = areas.map((area) => {
            const areaCompanies = visibleCompanies.filter((c) => c.area === area.key);
            const js = areaCompanies.flatMap(jobsOf);
            return {
                key: area.key,
                label: area.label,
                lat: area.lat,
                lng: area.lng,
                defaultZoom: area.default_zoom,
                count: js.length,
                internCount: js.filter((j) => j.is_internship).length,
                companyCount: areaCompanies.length,
            };
        });
        return rows.sort((a, b) => b.count - a.count);
    }, [areas, visibleCompanies, jobsOf]);

    const maxRailCount = Math.max(1, ...railRows.map((r) => r.count));

    const selected = companies.find((c) => c.id === selectedId) ?? null;
    const selectedJobs = selected ? [...jobsOf(selected)].sort((a, b) => (a.days_ago ?? 999) - (b.days_ago ?? 999)) : [];

    useEffect(() => {
        if (mapRef.current || !mapEl.current) return;

        const map = L.map(mapEl.current, { zoomControl: false, maxZoom: 16 }).setView(KOLKATA_CENTER, DEFAULT_ZOOM);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        const cluster = L.markerClusterGroup({
            maxClusterRadius: 42,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: (c) => {
                const jobCount = c.getAllChildMarkers().reduce((sum, m) => sum + (m.options.jobCount || 0), 0);
                const hasInternship = c.getAllChildMarkers().some((m) => m.options.hasInternship);
                const size = jobCount > 20 ? 46 : jobCount > 8 ? 40 : 34;
                return L.divIcon({
                    // a cluster of companies with nothing open shows its company count, muted
                    className: `cluster${jobCount ? (hasInternship ? ' int' : '') : ' zero'}`,
                    html: `<div class="b" style="width:${size}px;height:${size}px">${jobCount || c.getChildCount()}</div>`,
                    iconSize: [size, size],
                });
            },
        });
        cluster.addTo(map);
        clusterRef.current = cluster;

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
        if (labelLayerRef.current) map.removeLayer(labelLayerRef.current);

        // Esri's free Canvas basemap tiles — no API key required, unlike CARTO's
        // anonymous basemaps.cartocdn.com endpoints which now return "API key
        // required" watermark tiles. Base (roads/water fills) + Reference
        // (place labels) are separate transparent-label layers, stacked.
        const variant = theme === 'light' ? 'Light' : 'Dark';
        const base = `World_${variant}_Gray_Base`;
        const ref = `World_${variant}_Gray_Reference`;
        const attribution = '&copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, DeLorme, NAVTEQ';

        tileLayerRef.current = L.tileLayer(
            `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${base}/MapServer/tile/{z}/{y}/{x}`,
            { maxZoom: 16, attribution },
        ).addTo(map);

        labelLayerRef.current = L.tileLayer(
            `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${ref}/MapServer/tile/{z}/{y}/{x}`,
            { maxZoom: 16, pane: 'shadowPane' },
        ).addTo(map);
    }, [theme]);

    useEffect(() => {
        const cluster = clusterRef.current;
        if (!cluster) return;

        cluster.clearLayers();

        const markers = visibleCompanies.map((company) => {
            const js = jobsOf(company);
            const count = js.length;
            const hasInternship = js.some((j) => j.is_internship);
            const isNew = js.some((j) => j.days_ago != null && j.days_ago <= 3);
            const isSelected = company.id === selectedId;

            const cls = 'pin' + (count ? (hasInternship ? ' int' : '') : ' zero') + (isNew ? ' new' : '') + (isSelected ? ' sel' : '');

            const icon = L.divIcon({
                className: cls,
                html: `<div class="b">${count || ''}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            });

            const marker = L.marker([company.lat, company.lng], {
                icon,
                title: company.name,
                jobCount: count,
                hasInternship,
            });
            marker.on('click', () => openCompany(company));
            return marker;
        });

        cluster.addLayers(markers);
    }, [visibleCompanies, jobsOf, selectedId]);

    useEffect(() => {
        if (!selectedId && !railOpenMobile) return;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            setSelectedId(null);
            setRailOpenMobile(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedId, railOpenMobile]);

    function flyToArea(row) {
        const map = mapRef.current;
        if (!map) return;
        const same = filters.area === row.key;
        setFilters((f) => ({ ...f, area: same ? '' : row.key }));
        setSelectedId(null);
        map.flyTo(same ? KOLKATA_CENTER : [row.lat, row.lng], same ? DEFAULT_ZOOM : (row.defaultZoom ?? 14.4), { duration: 0.7 });
    }

    function openCompany(company) {
        setSelectedId(company.id);
        mapRef.current?.flyTo([company.lat, company.lng], 15, { duration: 0.6 });
        setRailOpenMobile(false);
    }

    function closeSheet() {
        setSelectedId(null);
    }

    function resetFilters() {
        setFilters(EMPTY_FILTERS);
        setSelectedId(null);
        mapRef.current?.flyTo(KOLKATA_CENTER, DEFAULT_ZOOM);
    }

    function toggleChip(key) {
        setFilters((f) => ({ ...f, [key]: !f[key] }));
    }

    return (
        <div className="flex h-full flex-col">
            {/* search + live status row */}
            <div
                className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5"
                style={{ borderColor: 'var(--edge)', background: 'var(--bg)' }}
            >
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--mute)' }}>
                    <span className="pulse-dot" />
                    <span>
                        {totalJobs} open role{totalJobs === 1 ? '' : 's'} · {totalInterns} internship{totalInterns === 1 ? '' : 's'}
                    </span>
                </div>
                <span className="flex-1" />
                <div className="q-wrap w-full sm:w-72">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                        className="q w-full"
                        type="search"
                        placeholder="Search role, skill or company…"
                        value={filters.q}
                        onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Escape' && setFilters((f) => ({ ...f, q: '' }))}
                        aria-label="Search"
                    />
                    {filters.q && (
                        <button
                            type="button"
                            className="q-clear"
                            onClick={() => setFilters((f) => ({ ...f, q: '' }))}
                            aria-label="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
                <Link href={route('submit')} className="ghost">
                    <span aria-hidden="true" className="text-base leading-none" style={{ color: 'var(--marigold)' }}>+</span>
                    Add an opening
                </Link>
            </div>

            {/* filter chips */}
            <div
                className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5"
                style={{ borderColor: 'var(--edge)', background: 'var(--bg)' }}
            >
                {CHIPS.map((chip) => (
                    <button
                        key={chip.key}
                        type="button"
                        className={`chip ${filters[chip.key] ? 'on' : ''}`}
                        data-k={chip.key}
                        aria-pressed={filters[chip.key]}
                        onClick={() => toggleChip(chip.key)}
                    >
                        <span className="dot" aria-hidden="true" />
                        {chip.label}
                    </button>
                ))}

                <select
                    className={`khm-select ${filters.sector ? 'set' : ''}`}
                    aria-label="Sector"
                    value={filters.sector}
                    onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
                >
                    <option value="">All sectors</option>
                    {sectors.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <select
                    className={`khm-select ${filters.type ? 'set' : ''}`}
                    aria-label="Company type"
                    value={filters.type}
                    onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                >
                    <option value="">All company types</option>
                    {types.map((t) => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>

                <select
                    className={`khm-select ${filters.exp ? 'set' : ''}`}
                    aria-label="Experience"
                    value={filters.exp}
                    onChange={(e) => setFilters((f) => ({ ...f, exp: e.target.value }))}
                >
                    <option value="">Any experience</option>
                    {experienceBuckets.map((exp) => (
                        <option key={exp} value={exp}>{exp}</option>
                    ))}
                </select>

                <button type="button" className="chip ml-auto" onClick={resetFilters} disabled={!activeFilterCount && !selectedId}>
                    Reset
                    {activeFilterCount > 0 && <span className="chip-count">{activeFilterCount}</span>}
                </button>
            </div>

            {/* shell */}
            <div className="relative flex-1">
                <div ref={mapEl} className="absolute inset-0" />

                <aside className={`rail ${railOpenMobile ? 'khm-rail-mobile-open' : ''}`}>
                    <h2>Hiring by area</h2>
                    <div className="scroll">
                        {railRows.map((row) => (
                            <button
                                key={row.key}
                                type="button"
                                className={`ar ${filters.area === row.key ? 'on' : ''}`}
                                onClick={() => flyToArea(row)}
                            >
                                <div className="r1">
                                    <span className="nm">{row.label}</span>
                                    <span className="ct" style={!row.count ? { color: 'var(--rail-count-zero)' } : undefined}>
                                        {row.count}
                                    </span>
                                </div>
                                <div className="bar">
                                    <span className="g" style={{ width: `${((row.count - row.internCount) / maxRailCount) * 100}%` }} />
                                    <span className="o" style={{ width: `${(row.internCount / maxRailCount) * 100}%` }} />
                                </div>
                                <div className="sub">
                                    {row.companyCount} compan{row.companyCount === 1 ? 'y' : 'ies'}
                                    {row.internCount ? ` · ${row.internCount} internship${row.internCount > 1 ? 's' : ''}` : ''}
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="foot">
                        We never take your application. Every role links out to <b>where it was actually posted</b>.
                    </div>
                </aside>

                <section className={`sheet ${selected ? 'show' : ''}`}>
                    {selected && (
                        <>
                            <div className="hd">
                                {logoFor(selected) && (
                                    <img
                                        key={selected.id}
                                        className="lg"
                                        src={logoFor(selected)}
                                        alt=""
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                )}
                                <div className="min-w-0">
                                    <h3>
                                        {selected.name}
                                        {selected.is_verified && (
                                            <span className="verified-badge" title="Verified by Kolkata Hiring Map">✓</span>
                                        )}
                                    </h3>
                                    <div className="where">
                                        {[...new Set([selected.address, selected.type, selected.sector].filter(Boolean))].join(' · ')}
                                    </div>
                                    <Link href={route('company.show', selected.slug)} className="profile-link">
                                        Company profile →
                                    </Link>
                                </div>
                                <button className="x" onClick={closeSheet} aria-label="Close">✕</button>
                            </div>
                            <div className="roles">
                                {selectedJobs.length === 0 ? (
                                    <div className="empty">
                                        No openings listed right now.
                                        <br />
                                        <Link href={route('submit')} className="font-bold" style={{ color: 'var(--marigold)' }}>
                                            Seen one? Tell us →
                                        </Link>
                                    </div>
                                ) : (
                                    selectedJobs.map((job) => (
                                        <div key={job.id} className={`jb ${job.is_internship ? 'intern' : ''}`}>
                                            <div className="t">{job.title}</div>
                                            <div className="meta">
                                                {job.is_internship && <span className="tag i">Internship</span>}
                                                {job.is_fresher_ok && !job.is_internship && <span className="tag f">Freshers welcome</span>}
                                                {job.exp_bucket && <span className="tag">{job.exp_bucket}</span>}
                                                <span className="tag pay">{formatPay(job)}</span>
                                            </div>
                                            <div className="src">
                                                <span className="ago">{job.source_label} · {ago(job.days_ago)}</span>
                                                <a className="open" href={job.apply_url} target="_blank" rel="noopener noreferrer nofollow">
                                                    Open posting ↗︎
                                                </a>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="note">
                                Listings are collected from company career pages and job boards. Always verify on the original posting.
                            </div>
                        </>
                    )}
                </section>

                <button
                    type="button"
                    className={`khm-mob ${selected ? 'hidden-by-sheet' : ''}`}
                    onClick={() => setRailOpenMobile((v) => !v)}
                    aria-expanded={railOpenMobile}
                >
                    {railOpenMobile ? '✕ Close' : '☰ Areas'}
                </button>
            </div>
        </div>
    );
}
