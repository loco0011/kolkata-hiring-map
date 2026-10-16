"""Client for the Laravel site's /api/ingest/* (app/Http/Controllers/IngestController.php)."""

import requests
from django.conf import settings

# Laravel caps a /jobs request at 2000 jobs; stay well under it.
JOBS_PER_REQUEST = 500


class LaravelError(Exception):
    pass


class LaravelClient:
    def __init__(self, base_url=None, token=None, session=None):
        self.base_url = (base_url or settings.LARAVEL_BASE_URL).rstrip("/")
        token = token if token is not None else settings.INGEST_API_TOKEN
        if not token:
            raise LaravelError("INGEST_API_TOKEN is not set in fetcher/.env.")
        self.session = session or requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/json"})

    def companies(self) -> list[dict]:
        return self._request("GET", "companies")["companies"]

    def push_jobs(self, source, jobs, companies_scanned=0, errors=None) -> dict:
        """Returns Laravel's {"counts": {...}, "results": [{"index", "outcome"}, ...]} merged across chunks."""
        merged = {"counts": {}, "results": []}
        chunks = [jobs[i:i + JOBS_PER_REQUEST] for i in range(0, len(jobs), JOBS_PER_REQUEST)] or [[]]
        for n, chunk in enumerate(chunks):
            body = self._request("POST", "jobs", json={
                "source": source,
                # only the first chunk carries the run-level numbers
                "companies_scanned": companies_scanned if n == 0 else 0,
                "errors": (errors or None) if n == 0 else None,
                "jobs": chunk,
            })
            offset = n * JOBS_PER_REQUEST
            for key, value in body["counts"].items():
                merged["counts"][key] = merged["counts"].get(key, 0) + value
            merged["results"] += [{**r, "index": r["index"] + offset} for r in body["results"]]
        return merged

    def live_postings(self) -> list[dict]:
        return self._request("GET", "postings")["postings"]

    def push_checks(self, results) -> dict:
        return self._request("POST", "checks", json={"results": results})

    def _request(self, method, path, **kwargs):
        url = f"{self.base_url}/api/ingest/{path}"
        try:
            response = self.session.request(method, url, timeout=60, **kwargs)
        except requests.RequestException as exc:
            raise LaravelError(f"Could not reach {url}: {exc}") from exc
        if response.status_code == 401:
            raise LaravelError("Laravel rejected the token — INGEST_API_TOKEN must match in both .env files.")
        if response.status_code == 503:
            raise LaravelError("The ingest API is off — set INGEST_API_TOKEN in the Laravel .env.")
        if response.status_code >= 400:
            raise LaravelError(f"{method} {url} → HTTP {response.status_code}: {response.text[:500]}")
        return response.json()
