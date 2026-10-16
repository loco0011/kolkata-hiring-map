"""
Zoho Recruit careers site (<org>.zohorecruit.in/jobs/Careers).

The page embeds its job list as JSON in <input type="hidden" id="jobs">.
The token is the full host — acme.zohorecruit.in and acme.zohorecruit.com
can be two different organisations.
"""

import html
import json
import re

from ..normalize import NormalizedJob, clip, exp_bucket_from_years, parse_date
from ..web import TIMEOUT

HOST_RE = re.compile(r"^[a-z0-9][a-z0-9-]*\.zohorecruit\.(com|in|eu|com\.au|jp)$")
_JOBS_INPUT_RE = re.compile(r"<input\b[^>]*\bid=[\"']jobs[\"'][^>]*>", re.IGNORECASE)
_VALUE_RE = re.compile(r"\bvalue=\"([^\"]*)\"|\bvalue='([^']*)'", re.IGNORECASE)


class ZohoRecruitError(Exception):
    pass


def fetch(http, token, robots=None):
    host = token.lower()
    if not HOST_RE.match(host):
        raise ZohoRecruitError(f"token must be the careers host, e.g. acme.zohorecruit.in — got {token!r}")

    response = http.get(f"https://{host}/jobs/Careers", timeout=TIMEOUT)
    response.raise_for_status()
    if "<title>Page does not exist" in response.text:
        raise ZohoRecruitError(f"no careers site at {host}")
    return parse(response.text, host)


def parse(page_html, host):
    tag = _JOBS_INPUT_RE.search(page_html)
    value = _VALUE_RE.search(tag.group(0)) if tag else None
    if not value:
        return []
    try:
        items = json.loads(html.unescape(value.group(1) or value.group(2) or "[]"))
    except json.JSONDecodeError:
        return []

    jobs = []
    for item in items:
        title = item.get("Posting_Title") or item.get("Job_Opening_Name")
        if not item.get("id") or not title or item.get("Publish") is False:
            continue
        place = ", ".join(p for p in (item.get("City"), item.get("State"), item.get("Country"))
                          if p and str(p).strip().upper() not in ("NA", "N/A", "-"))
        slug = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-")
        jobs.append(NormalizedJob(
            external_id=str(item["id"]),
            title=clip(title),
            apply_url=f"https://{host}/jobs/Careers/{item['id']}/{slug}",
            locations=[clip(place)] if place else [],
            work_mode="remote" if item.get("Remote_Job") is True else None,
            posted_at=parse_date(item.get("Date_Opened")),
            exp_bucket=exp_bucket_from_years(item.get("Work_Experience")),
        ))
    return jobs
