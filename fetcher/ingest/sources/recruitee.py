"""Recruitee careers site API — https://docs.recruitee.com/reference/offers"""

from ..normalize import NormalizedJob, clip, parse_date
from ..web import TIMEOUT


def fetch(http, token, robots=None):
    response = http.get(f"https://{token}.recruitee.com/api/offers/", timeout=TIMEOUT)
    response.raise_for_status()

    jobs = []
    for item in response.json().get("offers", []):
        if item.get("status", "published") != "published" or not item.get("careers_url") or not item.get("title"):
            continue
        if item.get("remote"):
            work_mode = "remote"
        elif item.get("hybrid"):
            work_mode = "hybrid"
        elif item.get("on_site"):
            work_mode = "onsite"
        else:
            work_mode = None
        locations = [item.get("location"), ", ".join(p for p in (item.get("city"), item.get("country")) if p)]
        jobs.append(NormalizedJob(
            external_id=str(item["id"]),
            title=clip(item["title"]),
            apply_url=item["careers_url"],
            locations=[clip(loc) for loc in dict.fromkeys(locations) if loc],
            department=clip(item.get("department")),
            work_mode=work_mode,
            posted_at=parse_date(item.get("published_at")),
        ))
    return jobs
