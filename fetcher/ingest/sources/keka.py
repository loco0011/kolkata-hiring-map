"""Keka careers site (<token>.keka.com/careers) — the JSON its job list page loads."""

from ..normalize import NormalizedJob, clip, exp_bucket_from_years, parse_date
from ..web import TIMEOUT


def fetch(http, token, robots=None):
    base = f"https://{token}.keka.com/careers"
    response = http.get(f"{base}/api/jobs/default/active", headers={"Accept": "application/json"}, timeout=TIMEOUT)
    response.raise_for_status()

    jobs = []
    for item in response.json() or []:
        if not item.get("id") or not str(item.get("title") or "").strip():
            continue
        locations = [
            ", ".join(p for p in (loc.get("city") or loc.get("name"), loc.get("state"), loc.get("countryName")) if p)
            for loc in item.get("jobLocations") or []
        ]
        jobs.append(NormalizedJob(
            external_id=str(item["id"]),
            title=clip(item["title"]),
            apply_url=f"{base}/jobdetails/{item['id']}",
            locations=[clip(loc) for loc in locations if loc],
            department=clip(item.get("departmentName")),
            posted_at=parse_date(item.get("publishedOn")),
            exp_bucket=exp_bucket_from_years(item.get("experience")),
        ))
    return jobs
