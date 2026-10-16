"""Workable public jobs widget API (the feed behind apply.workable.com/<account>)."""

from ..normalize import NormalizedJob, clip, parse_date
from ..web import TIMEOUT


def _place(city, region, country):
    return ", ".join(part for part in (city, region, country) if part)


def fetch(http, token, robots=None):
    response = http.get(f"https://apply.workable.com/api/v1/widget/accounts/{token}", timeout=TIMEOUT)
    response.raise_for_status()

    jobs = []
    for item in response.json().get("jobs", []):
        url = item.get("url") or item.get("shortlink") or item.get("application_url")
        if not url or not item.get("title"):
            continue
        locations = [_place(item.get("city"), item.get("state"), item.get("country"))]
        locations += [_place(loc.get("city"), loc.get("region"), loc.get("country")) for loc in item.get("locations") or []]
        jobs.append(NormalizedJob(
            external_id=str(item.get("shortcode") or item.get("code") or url),
            title=clip(item["title"]),
            apply_url=url,
            locations=[clip(loc) for loc in dict.fromkeys(locations) if loc],
            department=clip(item.get("department")),
            work_mode="remote" if item.get("telecommuting") else None,
            posted_at=parse_date(item.get("published_on") or item.get("created_at")),
        ))
    return jobs
