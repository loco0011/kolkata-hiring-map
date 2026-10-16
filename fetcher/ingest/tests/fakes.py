import json

import requests


class FakeResponse:
    def __init__(self, status_code=200, body=""):
        self.status_code = status_code
        self.text = body if isinstance(body, str) else json.dumps(body)

    def json(self):
        return json.loads(self.text)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")


class FakeHttp:
    """Stands in for requests.Session: maps URL prefixes to responses (or exceptions to raise)."""

    def __init__(self, routes=None):
        self.routes = routes or {}
        self.calls = []

    def get(self, url, **kwargs):
        return self._respond(url, kwargs)

    def post(self, url, **kwargs):
        return self._respond(url, kwargs)

    def _respond(self, url, kwargs):
        self.calls.append(url)
        self.last_kwargs = kwargs
        for prefix, response in sorted(self.routes.items(), key=lambda kv: -len(kv[0])):
            if url.startswith(prefix):
                if isinstance(response, list):  # successive calls get successive responses
                    response = response.pop(0) if len(response) > 1 else response[0]
                if isinstance(response, Exception):
                    raise response
                return response
        return FakeResponse(404, "")


class FakeLaravel:
    """Stands in for LaravelClient, recording what was pushed."""

    def __init__(self, companies=None, postings=None, outcome="queued"):
        self._companies = companies or []
        self._postings = postings or []
        self.outcome = outcome
        self.pushed_jobs = []
        self.pushed_checks = []

    def companies(self):
        return self._companies

    def push_jobs(self, source, jobs, companies_scanned=0, errors=None):
        self.pushed_jobs.append({"source": source, "jobs": jobs, "companies_scanned": companies_scanned, "errors": errors})
        return {
            "counts": {self.outcome: len(jobs)},
            "results": [{"index": i, "outcome": self.outcome} for i in range(len(jobs))],
        }

    def live_postings(self):
        return self._postings

    def push_checks(self, results):
        self.pushed_checks.append(results)
        counts = {"alive": 0, "dead": 0, "unknown": 0, "closed": 0, "ignored": 0}
        for r in results:
            counts[r["result"]] += 1
        return {"counts": counts}
