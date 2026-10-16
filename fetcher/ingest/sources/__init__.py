"""
One adapter per place jobs come from. Each is `fetch(http, target, robots) -> list[NormalizedJob]`:

- ATS adapters take the company's board token (companies.ats_token in Laravel)
  and read the same job data the company's careers site shows: a public
  job-board API (greenhouse, lever, ashby, workable, recruitee) or the feed the
  careers site itself loads (freshteam, darwinbox, keka, zohorecruit).
- `jsonld` takes a careers page URL (companies.careers_url) and reads any
  schema.org JobPosting data embedded in it, after checking robots.txt.

Adapters raise on network/HTTP errors; the fetch run records the error and
moves on to the next company.
"""

import re

from . import ashby, darwinbox, freshteam, greenhouse, jsonld, keka, lever, recruitee, workable, zohorecruit

ATS_SOURCES = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "ashby": ashby.fetch,
    "workable": workable.fetch,
    "recruitee": recruitee.fetch,
    "freshteam": freshteam.fetch,
    "darwinbox": darwinbox.fetch,
    "keka": keka.fetch,
    "zohorecruit": zohorecruit.fetch,
}

SOURCES = {**ATS_SOURCES, "jsonld": jsonld.fetch}

# Board tokens are dropped into API URLs (several use it as a subdomain; zohorecruit's is the whole host),
# so only accept the plain slugs ATS vendors actually issue.
_TOKEN_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$")


def valid_token(token: str | None) -> bool:
    return bool(token and _TOKEN_RE.match(token))
