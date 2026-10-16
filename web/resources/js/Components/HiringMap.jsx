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

// Small building, used for companies that are on the map but not hiring right now
const BUILDING_PATHS = 'M3 14V3.5L9 2v12M9 14V6.5l4.5 1.5V14M1.5 14h13M5 5.5h1.5M5 8h1.5M5 10.5h1.5';
const BUILDING_SVG = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${BUILDING_PATHS}"/></svg>`;
// Hover card above the pin, or below it when the pin is near the top of the map
// (the card is ~190px tall). Registered before bindTooltip so it runs first.
function attachTip(map, marker, html) {
    marker.on('mouseover', () => {
        const tip = marker.getTooltip();
        if (!tip) return;
        const below = map.latLngToContainerPoint(marker.getLatLng()).y < 220;
        tip.options.direction = below ? 'bottom' : 'top';
        tip.options.offset = below ? [0, 14] : [0, -14];
    });
    marker.bindTooltip(html, { direction: 'top', offset: [0, -14], className: 'khm-tip', opacity: 1 });
}

const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Hover card for a company pin: logo, name, where, and what's open.
function companyTip(company, jobs, areaLabel) {
    const logo = logoFor(company);
    const initial = esc((company.name || '?').trim().charAt(0).toUpperCase());
    const where = [company.sector, areaLabel].filter(Boolean).map(esc).join(' · ');

    let body;
    if (jobs.length) {
        const recent = [...jobs].sort((a, b) => (a.days_ago ?? 999) - (b.days_ago ?? 999));
        const titles = recent
            .slice(0, 2)
            .map((j) => `<li>${esc(j.title)}${j.is_internship ? ' <em>Internship</em>' : ''}</li>`)
            .join('');
        const more = jobs.length > 2 ? `<li class="more">+${jobs.length - 2} more</li>` : '';
        body = `<div class="st on"><i></i>${jobs.length} open role${jobs.length === 1 ? '' : 's'}</div><ul>${titles}${more}</ul>`;
    } else {
        body = '<div class="st"><i></i>Not hiring right now</div>';
    }

    return `<div class="tip ${jobs.length ? 'hiring' : 'idle'}"><div class="hd"><span class="lo">${initial}${logo ? `<img src="${esc(logo)}" alt="" onerror="this.remove()">` : ''}</span><span><b>${esc(company.name)}</b>${where ? `<small>${where}</small>` : ''}</span></div>${body}<div class="cta">Click for details <span aria-hidden="true">→</span></div></div>`;
}

function BuildingIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d={BUILDING_PATHS} />
        </svg>
    );
}

function FilterGroup({ title, children }) {
    return (
        <div className="fs-group">
            <h3>{title}</h3>
            <div className="opts">{children}</div>
        </div>
    );
}

// Tap-to-pick options for one filter; "Any"/"All" clears it.
function Options({ value, options, anyLabel, onChange }) {
    return (
        <>
            <button type="button" className={`opt ${value ? '' : 'on'}`} aria-pressed={!value} onClick={() => onChange('')}>
                {anyLabel}
            </button>
            {options.map((o) => (
                <button key={o} type="button" className={`opt ${value === o ? 'on' : ''}`} aria-pressed={value === o} onClick={() => onChange(value === o ? '' : o)}>
                    {o}
                </button>
            ))}
        </>
    );
}

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
    const idleClusterRef = useRef(null);
    const tileLayerRef = useRef(null);
    const labelLayerRef = useRef(null);
    const [theme] = useTheme();
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [selectedId, setSelectedId] = useState(null);
    const [railOpenMobile, setRailOpenMobile] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [showIdle, setShowIdle] = useState(true);
    const areaLabels = useMemo(() => Object.fromEntries(areas.map((a) => [a.key, a.label])), [areas]);

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
                hiringCount: areaCompanies.filter((c) => jobsOf(c).length > 0).length,
            };
        });
        return rows.sort((a, b) => b.count - a.count || b.companyCount - a.companyCount);
    }, [areas, visibleCompanies, jobsOf]);

    // Bars show each area's share of all open roles, so a quiet map doesn't
    // draw every area at 100%.
    const railTotal = Math.max(1, totalJobs);
    const idleCount = useMemo(() => visibleCompanies.filter((c) => jobsOf(c).length === 0).length, [visibleCompanies, jobsOf]);

    const selected = companies.find((c) => c.id === selectedId) ?? null;
    const selectedJobs = selected ? [...jobsOf(selected)].sort((a, b) => (a.days_ago ?? 999) - (b.days_ago ?? 999)) : [];

    useEffect(() => {
        if (mapRef.current || !mapEl.current) return;

        const map = L.map(mapEl.current, { zoomControl: false, maxZoom: 16 }).setView(KOLKATA_CENTER, DEFAULT_ZOOM);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Companies with open roles. Clusters show the total open roles.
        const cluster = L.markerClusterGroup({
            maxClusterRadius: 42,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: (c) => {
                const jobCount = c.getAllChildMarkers().reduce((sum, m) => sum + (m.options.jobCount || 0), 0);
                const hasInternship = c.getAllChildMarkers().some((m) => m.options.hasInternship);
                const size = jobCount > 20 ? 46 : jobCount > 8 ? 40 : 34;
                return L.divIcon({
                    className: `cluster${hasInternship ? ' int' : ''}`,
                    html: `<div class="b" style="width:${size}px;height:${size}px">${jobCount}</div>`,
                    iconSize: [size, size],
                });
            },
        });

        // Companies on the map but not hiring right now: their own group, in a
        // pane under the hiring pins, so they never mix into the role counts.
        map.createPane('idlePane');
        map.getPane('idlePane').style.zIndex = 590;
        const idleCluster = L.markerClusterGroup({
            clusterPane: 'idlePane',
            maxClusterRadius: 36,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: (c) =>
                L.divIcon({
                    className: 'cluster idle',
                    html: `<div class="b">${BUILDING_SVG}<span>${c.getChildCount()}</span></div>`,
                    iconSize: [44, 26],
                    // hang just below the point, so a hiring pin in the same spot stays readable
                    iconAnchor: [22, -8],
                }),
        });

        idleCluster.addTo(map);
        cluster.addTo(map);
        clusterRef.current = cluster;
        idleClusterRef.current = idleCluster;

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
        const idleCluster = idleClusterRef.current;
        if (!cluster || !idleCluster) return;

        cluster.clearLayers();
        idleCluster.clearLayers();

        const hiring = [];
        const idle = [];

        visibleCompanies.forEach((company) => {
            const js = jobsOf(company);
            const count = js.length;
            const isSelected = company.id === selectedId;

            if (!count) {
                if (!showIdle && !isSelected) return;
                const marker = L.marker([company.lat, company.lng], {
                    pane: 'idlePane',
                    icon: L.divIcon({
                        className: 'pin idle' + (isSelected ? ' sel' : ''),
                        html: `<div class="b">${BUILDING_SVG}</div>`,
                        iconSize: [22, 22],
                        iconAnchor: [11, 11],
                    }),
                });
                attachTip(mapRef.current, marker, companyTip(company, js, areaLabels[company.area]));
                marker.on('click', () => openCompany(company));
                idle.push(marker);
                return;
            }

            const hasInternship = js.some((j) => j.is_internship);
            const isNew = js.some((j) => j.days_ago != null && j.days_ago <= 3);
            const cls = 'pin' + (hasInternship ? ' int' : '') + (isNew ? ' new' : '') + (isSelected ? ' sel' : '');

            const marker = L.marker([company.lat, company.lng], {
                icon: L.divIcon({
                    className: cls,
                    html: `<div class="b">${count}</div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                }),
                jobCount: count,
                hasInternship,
            });
            attachTip(mapRef.current, marker, companyTip(company, js, areaLabels[company.area]));
            marker.on('click', () => openCompany(company));
            hiring.push(marker);
        });

        cluster.addLayers(hiring);
        idleCluster.addLayers(idle);
    }, [visibleCompanies, jobsOf, selectedId, showIdle, areaLabels]);

    useEffect(() => {
        if (!selectedId && !railOpenMobile && !filtersOpen) return;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            setSelectedId(null);
            setRailOpenMobile(false);
            setFiltersOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedId, railOpenMobile, filtersOpen]);

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

    // Sheet filters shown as removable pills in the phone's chip row
    const sheetPills = [
        filters.exp && { key: 'exp', label: filters.exp },
        filters.sector && { key: 'sector', label: filters.sector },
        filters.type && { key: 'type', label: filters.type },
        filters.area && { key: 'area', label: areaLabels[filters.area] ?? filters.area },
    ].filter(Boolean);
    const sheetFilterCount = [filters.exp, filters.sector, filters.type].filter(Boolean).length;

    return (
        <div className="khm-maproot flex h-full flex-col">
            {/* search + live status row (floats over the map on phones) */}
            <div className="khm-toolbar">
                <div className="tb-row">
                    <div className="tb-status">
                        <span className="pulse-dot" />
                        <span>
                            {totalJobs} open role{totalJobs === 1 ? '' : 's'} · {totalInterns} internship{totalInterns === 1 ? '' : 's'}
                        </span>
                    </div>
                    <span className="tb-gap" />
                    <div className="q-wrap tb-search">
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
                    <button
                        type="button"
                        className={`filter-btn ${sheetFilterCount ? 'on' : ''}`}
                        onClick={() => {
                            setFiltersOpen(true);
                            setRailOpenMobile(false);
                            setSelectedId(null);
                        }}
                        aria-label={`Filters${sheetFilterCount ? ` (${sheetFilterCount} on)` : ''}`}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
                            <circle cx="16" cy="6" r="2" />
                            <circle cx="10" cy="12" r="2" />
                            <circle cx="18" cy="18" r="2" />
                        </svg>
                        {sheetFilterCount > 0 && <span className="badge">{sheetFilterCount}</span>}
                    </button>
                    <Link href={route('submit')} className="ghost tb-add">
                        <span aria-hidden="true" className="text-base leading-none" style={{ color: 'var(--marigold)' }}>+</span>
                        Add an opening
                    </Link>
                </div>
    
                {/* filter chips: a wrapping bar on desktop, one swipeable row on phones */}
                <div className="tb-chips">
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
    
                    {sheetPills.map((pill) => (
                        <button
                            key={pill.key}
                            type="button"
                            className="chip pill-set"
                            onClick={() => setFilters((f) => ({ ...f, [pill.key]: '' }))}
                            aria-label={`Remove filter ${pill.label}`}
                        >
                            {pill.label}
                            <span aria-hidden="true" className="x">✕</span>
                        </button>
                    ))}
    
                    <button type="button" className="chip reset" onClick={resetFilters} disabled={!activeFilterCount && !selectedId}>
                        Reset
                        {activeFilterCount > 0 && <span className="chip-count">{activeFilterCount}</span>}
                    </button>
                </div>
            </div>

            {/* shell */}
            <div className="relative flex-1">
                <div ref={mapEl} className="absolute inset-0" />

                {/* phones: dims the map behind an open panel; tap to close */}
                <div
                    className={`m-backdrop ${railOpenMobile || filtersOpen || selected ? 'show' : ''}`}
                    onClick={() => {
                        setRailOpenMobile(false);
                        setFiltersOpen(false);
                        setSelectedId(null);
                    }}
                    aria-hidden="true"
                />

                {/* phones: every filter in one slide-up panel */}
                <section className={`fsheet ${filtersOpen ? 'show' : ''}`} aria-label="Filters" aria-hidden={!filtersOpen}>
                    <div className="grab" aria-hidden="true" />
                    <div className="fs-hd">
                        <h2>Filters</h2>
                        <button type="button" className="fs-x" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                            ✕
                        </button>
                    </div>
                    <div className="fs-body">
                        <FilterGroup title="Show only">
                            {CHIPS.map((chip) => (
                                <button
                                    key={chip.key}
                                    type="button"
                                    className={`opt ${filters[chip.key] ? 'on' : ''}`}
                                    aria-pressed={filters[chip.key]}
                                    onClick={() => toggleChip(chip.key)}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </FilterGroup>
                        <FilterGroup title="Experience">
                            <Options value={filters.exp} options={experienceBuckets} anyLabel="Any" onChange={(v) => setFilters((f) => ({ ...f, exp: v }))} />
                        </FilterGroup>
                        <FilterGroup title="Sector">
                            <Options value={filters.sector} options={sectors} anyLabel="All" onChange={(v) => setFilters((f) => ({ ...f, sector: v }))} />
                        </FilterGroup>
                        <FilterGroup title="Company type">
                            <Options value={filters.type} options={types} anyLabel="All" onChange={(v) => setFilters((f) => ({ ...f, type: v }))} />
                        </FilterGroup>
                    </div>
                    <div className="fs-ft">
                        <button type="button" className="fs-reset" onClick={resetFilters} disabled={!activeFilterCount}>
                            Reset all
                        </button>
                        <button type="button" className="fs-go" onClick={() => setFiltersOpen(false)}>
                            Show {totalJobs} role{totalJobs === 1 ? '' : 's'}
                        </button>
                    </div>
                </section>

                <aside className={`rail ${railOpenMobile ? 'khm-rail-mobile-open' : ''}`}>
                    <div className="grab" aria-hidden="true" />
                    <h2>Hiring by area</h2>
                    <div className="scroll">
                        {railRows.map((row) => (
                            <button
                                key={row.key}
                                type="button"
                                className={`ar ${filters.area === row.key ? 'on' : ''} ${row.count ? '' : 'zero'}`}
                                onClick={() => flyToArea(row)}
                            >
                                <div className="r1">
                                    <span className="nm">{row.label}</span>
                                    <span className="ct">
                                        {row.count ? (
                                            <>
                                                <b>{row.count}</b> open role{row.count === 1 ? '' : 's'}
                                            </>
                                        ) : (
                                            'No openings'
                                        )}
                                    </span>
                                </div>
                                <div className="bar">
                                    <span className="g" style={{ width: `${((row.count - row.internCount) / railTotal) * 100}%` }} />
                                    <span className="o" style={{ width: `${(row.internCount / railTotal) * 100}%` }} />
                                </div>
                                <div className="sub">
                                    {row.count
                                        ? `${row.hiringCount} of ${row.companyCount} compan${row.companyCount === 1 ? 'y' : 'ies'} hiring`
                                        : `${row.companyCount} compan${row.companyCount === 1 ? 'y' : 'ies'}`}
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
                            <div className="grab" aria-hidden="true" />
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

                <div className="map-legend" aria-label="Map key">
                    <span className="lg">
                        <i className="sw hiring">1</i>
                        Hiring <small>· number = open roles</small>
                    </span>
                    {idleCount > 0 && (
                        <button
                            type="button"
                            className={`lg toggle ${showIdle ? '' : 'off'}`}
                            onClick={() => setShowIdle((v) => !v)}
                            aria-pressed={showIdle}
                            title={showIdle ? "Hide companies that aren't hiring" : "Show companies that aren't hiring"}
                        >
                            <i className="sw idle">
                                <BuildingIcon />
                            </i>
                            Not hiring now <small>({idleCount})</small>
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    className={`khm-mob ${selected || filtersOpen || railOpenMobile ? 'hidden-by-sheet' : ''}`}
                    onClick={() => setRailOpenMobile(true)}
                    aria-expanded={railOpenMobile}
                >
                    <span className="pulse-dot" aria-hidden="true" />
                    <b>{totalJobs}</b> open role{totalJobs === 1 ? '' : 's'}
                    <span className="sep" aria-hidden="true" />
                    Browse areas
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m6 15 6-6 6 6" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
