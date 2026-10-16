"""
Same probe rules as Laravel's `php artisan postings:check` (CheckJobPostings.php):

- alive   → page opens (2xx) and doesn't say the job is gone
- dead    → 404/410, or an "expired" phrase on the page
- unknown → bot walls (403/429/999), 5xx, timeouts — says nothing about the job

Laravel applies the strike rules to the results (JobPosting::recordCheck).
"""

import re

import requests

from .web import TIMEOUT

# Keep in sync with CheckJobPostings::DEAD_PHRASES.
DEAD_PHRASES = [
    "no longer accepting applications",
    "this job is no longer available",
    "job has expired",
    "this job has been closed",
    "position has been filled",
    "this position is closed",
    "job is closed",
    "job not found",
    "vacancy has expired",
]

_TAG_RE = re.compile(r"<[^>]+>")


def probe(http, url) -> tuple[str, str]:
    try:
        response = http.get(url, timeout=TIMEOUT, allow_redirects=True,
                            headers={"Accept": "text/html,application/xhtml+xml"})
    except requests.ConnectionError:
        return "unknown", "connection failed"
    except requests.Timeout:
        return "unknown", "timed out"
    except requests.RequestException as exc:
        return "unknown", type(exc).__name__

    status = response.status_code
    if status in (404, 410):
        return "dead", f"HTTP {status}"
    if not 200 <= status < 300:
        return "unknown", f"HTTP {status}"

    body = _TAG_RE.sub(" ", response.text).lower()
    for phrase in DEAD_PHRASES:
        if phrase in body:
            return "dead", f'page says "{phrase}"'
    return "alive", f"HTTP {status}"
