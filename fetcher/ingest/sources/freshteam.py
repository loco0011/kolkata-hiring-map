"""Freshteam careers site — the JSON feed behind its job widget (<token>.freshteam.com/hire/widgets/jobs.json)."""

from datetime import date

from ..normalize import NormalizedJob, clip, parse_date
from ..web import TIMEOUT


def fetch(http, token, robots=None, today=None):
    base = f"https://{token}.freshteam.com"
    response = http.get(f"{base}/hire/widgets/jobs.json", timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()

    today = today or date.today()
    branches = {b["id"]: b for b in data.get("branches") or [] if "id" in b}
    roles = {r["id"]: r.get("name") for r in data.get("job_roles") or [] if "id" in r}

    jobs = []
    for item in data.get("jobs") or []:
        if item.get("deleted") or not item.get("unique_id") or not str(item.get("title") or "").strip():
            continue
        closing = parse_date(item.get("closing_date"))
        if closing and closing < today:
            continue
        branch = branches.get(item.get("branch_id")) or {}
        locations = [
            branch.get("location"),
            ", ".join(p for p in (branch.get("city"), branch.get("state")) if p),
            item.get("preferred_remote_job_locations"),
        ]
        jobs.append(NormalizedJob(
            external_id=item["unique_id"],
            title=clip(item["title"]),
            apply_url=f"{base}/jobs/{item['unique_id']}",
            locations=[clip(loc) for loc in dict.fromkeys(locations) if loc],
            department=clip(roles.get(item.get("job_role_id"))),
            work_mode="remote" if item.get("remote") else None,
            posted_at=parse_date(item.get("created_at")),
        ))
    return jobs
