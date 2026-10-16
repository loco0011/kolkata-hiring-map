function domainOf(url) {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

/** Company logo, falling back to the site's favicon when no logo is stored. */
export function logoFor(company) {
    if (company.logo_url) return company.logo_url;
    const domain = domainOf(company.website);
    return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;
}

export function formatPay(job) {
    if (!job.pay_is_disclosed || (!job.pay_min && !job.pay_max)) {
        return 'Pay not disclosed';
    }

    const unit = job.pay_period === 'monthly' ? '/mo' : '/yr';
    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

    if (job.pay_min && job.pay_max && job.pay_min !== job.pay_max) {
        return `${fmt(job.pay_min)} – ${fmt(job.pay_max)}${unit}`;
    }

    return `${fmt(job.pay_min ?? job.pay_max)}${unit}`;
}

/** "today" / "3 days ago" / "2 weeks ago" from an ISO date string. */
export function postedAgo(iso) {
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (Number.isNaN(days)) return '';
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    return `${Math.floor(days / 7)} weeks ago`;
}
