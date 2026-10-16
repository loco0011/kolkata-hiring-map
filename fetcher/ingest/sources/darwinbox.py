"""
Darwinbox careers site (<token>.darwinbox.in/ms/candidatev2/main/careers/allJobs).

Reads the same paged endpoint the careers site calls. It sits behind
Cloudflare, which turns away POSTs that don't look like they came from the
careers page, hence the Origin/Referer headers.
"""

from ..normalize import NormalizedJob, clip, exp_bucket_from_years, parse_date
from ..web import TIMEOUT

PAGE_SIZE = 50
MAX_PAGES = 20


class DarwinboxError(Exception):
    pass


def fetch(http, token, robots=None):
    base = f"https://{token}.darwinbox.in"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": base,
        "Referer": f"{base}/ms/candidatev2/main/careers/allJobs",
    }

    jobs, seen = [], set()
    for page in range(1, MAX_PAGES + 1):
        response = http.post(f"{base}/ms/candidateapi/job/alljobs", json={"page": page, "limit": PAGE_SIZE},
                             headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        try:
            body = response.json()
        except ValueError:
            raise DarwinboxError("not JSON — probably a Cloudflare challenge page") from None
        if body.get("status") != "success":
            raise DarwinboxError(str(body.get("data") or body)[:200])

        items = body.get("data") or []
        for item in items:
            job_id = item.get("id")
            title = item.get("title") or item.get("designation_display_name")
            if not job_id or not title or job_id in seen:
                continue
            seen.add(job_id)
            locations = item.get("tool_tip_locations") or [item.get("locations") or item.get("officelocation_show_arr")]
            jobs.append(NormalizedJob(
                external_id=job_id,
                title=clip(title),
                apply_url=f"{base}/ms/candidatev2/main/careers/jobDetails/{job_id}",
                locations=[clip(" ".join(str(loc).split())) for loc in locations if loc],
                department=clip(item.get("department_name")),
                work_mode="remote" if str(item.get("is_remote")) == "1" else None,
                posted_at=parse_date(item.get("posted_on"), epoch_seconds=True) or parse_date(item.get("created_on")),
                exp_bucket=exp_bucket_from_years(item.get("experience_from")),
            ))

        if not items or len(seen) >= int(body.get("job_counts") or 0):
            break
    return jobs
