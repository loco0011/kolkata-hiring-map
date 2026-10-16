"""Ashby public job posting API — https://developers.ashbyhq.com/docs/public-job-posting-api"""

from ..normalize import NormalizedJob, clip, parse_date, work_mode_from
from ..web import TIMEOUT


def fetch(http, token, robots=None):
    response = http.get(f"https://api.ashbyhq.com/posting-api/job-board/{token}", timeout=TIMEOUT)
    response.raise_for_status()

    jobs = []
    for item in response.json().get("jobs", []):
        if item.get("isListed") is False or not item.get("jobUrl") or not item.get("title"):
            continue
        locations = [item.get("location"), *((s or {}).get("location") for s in item.get("secondaryLocations") or [])]
        work_mode = work_mode_from(item.get("workplaceType")) or ("remote" if item.get("isRemote") else None)
        jobs.append(NormalizedJob(
            external_id=str(item["id"]),
            title=clip(item["title"]),
            apply_url=item["jobUrl"],
            locations=[clip(loc) for loc in locations if loc],
            department=clip(item.get("department") or item.get("team")),
            work_mode=work_mode,
            posted_at=parse_date(item.get("publishedAt")),
        ))
    return jobs
