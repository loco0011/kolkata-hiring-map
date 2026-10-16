"""
schema.org JobPosting data embedded in a company's careers page
(<script type="application/ld+json">) — the same markup Google for Jobs reads.

Only pages that embed it yield anything; plenty of careers pages just link to
job pages, and those come back empty rather than being guessed at.
"""

import hashlib
import html
import json
import re
from datetime import date
from urllib.parse import urljoin

from ..normalize import NormalizedJob, clip, parse_date, work_mode_from
from ..web import TIMEOUT

_LD_RE = re.compile(
    r"<script[^>]+type\s*=\s*[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)


class RobotsDisallowed(Exception):
    pass


def fetch(http, careers_url, robots=None):
    if robots is not None and not robots.allowed(careers_url):
        raise RobotsDisallowed(f"robots.txt disallows {careers_url}")

    response = http.get(careers_url, timeout=TIMEOUT)
    response.raise_for_status()
    return parse(response.text, careers_url)


def parse(page_html, page_url, today=None):
    today = today or date.today()
    jobs, seen = [], set()

    for item in _job_postings(page_html):
        title = clip(html.unescape(str(item.get("title") or "")))
        if not title:
            continue

        valid_through = parse_date(item.get("validThrough"))
        if valid_through and valid_through < today:
            continue

        url = item.get("url") or item.get("sameAs") or page_url
        url = urljoin(page_url, str(url))

        identifier = item.get("identifier")
        if isinstance(identifier, dict):
            identifier = identifier.get("value")
        external_id = str(identifier) if identifier else hashlib.sha1(f"{url}|{title}".encode()).hexdigest()
        if external_id in seen:
            continue
        seen.add(external_id)

        jobs.append(NormalizedJob(
            external_id=external_id,
            title=title,
            apply_url=url,
            locations=_locations(item.get("jobLocation")),
            department=clip(item.get("occupationalCategory") if isinstance(item.get("occupationalCategory"), str) else ""),
            work_mode=work_mode_from(item.get("jobLocationType")),
            posted_at=parse_date(item.get("datePosted")),
        ))
    return jobs


def _job_postings(page_html):
    for raw in _LD_RE.findall(page_html):
        try:
            data = json.loads(raw.strip())
        except json.JSONDecodeError:
            continue
        yield from _walk(data)


def _walk(node):
    if isinstance(node, list):
        for child in node:
            yield from _walk(child)
    elif isinstance(node, dict):
        types = node.get("@type")
        types = types if isinstance(types, list) else [types]
        if "JobPosting" in types:
            yield node
        for key in ("@graph", "itemListElement", "item"):
            if key in node:
                yield from _walk(node[key])


def _locations(job_location):
    places = job_location if isinstance(job_location, list) else [job_location]
    out = []
    for place in places:
        if not isinstance(place, dict):
            continue
        address = place.get("address")
        if isinstance(address, str):
            out.append(clip(address))
        elif isinstance(address, dict):
            country = address.get("addressCountry")
            if isinstance(country, dict):
                country = country.get("name")
            parts = [address.get("streetAddress"), address.get("addressLocality"), address.get("addressRegion"), country]
            out.append(clip(", ".join(str(p) for p in parts if p)))
    return [loc for loc in out if loc]
