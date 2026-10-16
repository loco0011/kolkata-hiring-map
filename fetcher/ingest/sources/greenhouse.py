"""Greenhouse job board API — https://developers.greenhouse.io/job-board.html"""

from ..normalize import NormalizedJob, clip, parse_date
from ..web import TIMEOUT


def fetch(http, token, robots=None):
    response = http.get(f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs", timeout=TIMEOUT)
    response.raise_for_status()

    jobs = []
    for item in response.json().get("jobs", []):
        if not item.get("absolute_url") or not item.get("title"):
            continue
        jobs.append(NormalizedJob(
            external_id=str(item["id"]),
            title=clip(item["title"]),
            apply_url=item["absolute_url"],
            locations=[clip((item.get("location") or {}).get("name"))],
            posted_at=parse_date(item.get("first_published") or item.get("updated_at")),
        ))
    return jobs
