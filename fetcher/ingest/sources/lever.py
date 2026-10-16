"""Lever postings API — https://github.com/lever/postings-api"""

from ..normalize import NormalizedJob, clip, parse_date, work_mode_from
from ..web import TIMEOUT


def fetch(http, token, robots=None):
    response = http.get(f"https://api.lever.co/v0/postings/{token}", params={"mode": "json"}, timeout=TIMEOUT)
    response.raise_for_status()

    jobs = []
    for item in response.json():
        url = item.get("hostedUrl") or item.get("applyUrl")
        if not url or not item.get("text"):
            continue
        categories = item.get("categories") or {}
        locations = [categories.get("location"), *(categories.get("allLocations") or [])]
        jobs.append(NormalizedJob(
            external_id=str(item["id"]),
            title=clip(item["text"]),
            apply_url=url,
            locations=[clip(loc) for loc in dict.fromkeys(locations) if loc],
            department=clip(categories.get("department") or categories.get("team")),
            work_mode=work_mode_from(item.get("workplaceType")),
            posted_at=parse_date(item.get("createdAt")),
        ))
    return jobs
