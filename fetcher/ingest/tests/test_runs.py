import requests
from django.test import TestCase, override_settings

from ingest.linkcheck import probe
from ingest.models import FetchedJob, Run
from ingest.services import plan, run_fetch, run_link_check

from .fakes import FakeHttp, FakeLaravel, FakeResponse

GREENHOUSE_BOARD = {"jobs": [
    {"id": 1, "title": "Software Engineering Intern", "absolute_url": "https://boards.greenhouse.io/acme/jobs/1",
     "location": {"name": "Kolkata, India"}},
    {"id": 2, "title": "Senior Engineer", "absolute_url": "https://boards.greenhouse.io/acme/jobs/2",
     "location": {"name": "Bengaluru, India"}},
    {"id": 3, "title": "Duplicate of 1", "absolute_url": "https://boards.greenhouse.io/acme/jobs/1",
     "location": {"name": "Kolkata"}},
]}

COMPANIES = [
    {"slug": "acme", "name": "Acme", "ats_provider": "greenhouse", "ats_token": "acme", "careers_url": None},
    {"slug": "broken", "name": "Broken", "ats_provider": "lever", "ats_token": "broken", "careers_url": None},
    {"slug": "plain", "name": "Plain", "ats_provider": None, "ats_token": None, "careers_url": "https://plain.example/careers"},
    {"slug": "sneaky", "name": "Sneaky", "ats_provider": "recruitee", "ats_token": "evil.com/x", "careers_url": None},
]


def no_sleep(_):
    pass


class PlanTests(TestCase):
    def test_ats_board_wins_over_careers_page_and_filters_apply(self):
        companies = [{**COMPANIES[0], "careers_url": "https://acme.example/careers"}, COMPANIES[2]]
        self.assertEqual(plan(companies), [("acme", "greenhouse", "acme"), ("plain", "jsonld", "https://plain.example/careers")])
        self.assertEqual(plan(companies, provider="jsonld"), [("plain", "jsonld", "https://plain.example/careers")])
        self.assertEqual(plan(companies, company="acme"), [("acme", "greenhouse", "acme")])


@override_settings(INCLUDE_UNKNOWN_LOCATION=False, INCLUDE_REMOTE=False)
class FetchRunTests(TestCase):
    def setUp(self):
        self.http = FakeHttp({
            "https://boards-api.greenhouse.io/v1/boards/acme/jobs": FakeResponse(200, GREENHOUSE_BOARD),
            "https://api.lever.co/v0/postings/broken": FakeResponse(500, "oops"),
            "https://plain.example/robots.txt": FakeResponse(404),
            "https://plain.example/careers": FakeResponse(200, "<html>no jobs markup</html>"),
        })

    def test_fetches_filters_pushes_and_records(self):
        laravel = FakeLaravel(COMPANIES)
        run = run_fetch(laravel, self.http, sleep=no_sleep)

        self.assertTrue(run.ok)
        greenhouse = next(p for p in laravel.pushed_jobs if p["source"] == "greenhouse")
        self.assertEqual(len(greenhouse["jobs"]), 1, "Bengaluru job filtered out, duplicate URL dropped")
        sent = greenhouse["jobs"][0]
        self.assertEqual(sent["company_slug"], "acme")
        self.assertEqual(sent["exp_bucket"], "Intern")
        self.assertEqual(sent["location"], "Kolkata, India")

        # every scanned source reports a run, even with no jobs, so errors reach Laravel
        lever = next(p for p in laravel.pushed_jobs if p["source"] == "lever")
        self.assertEqual(lever["jobs"], [])
        self.assertIn("HTTPError", lever["errors"][0]["error"])

        self.assertEqual(run.stats["companies"], 4)
        self.assertEqual(run.stats["kept"], 1)
        self.assertEqual(run.stats["filtered_out"], 1)
        self.assertEqual(run.stats["queued"], 1)
        self.assertEqual({e["company"] for e in run.errors}, {"broken", "sneaky"})
        self.assertNotIn("https://evil.com", " ".join(self.http.calls))

        stored = FetchedJob.objects.get()
        self.assertEqual((stored.provider, stored.external_id, stored.outcome), ("greenhouse", "1", "queued"))
        self.assertEqual(stored.title, "Software Engineering Intern")

    def test_second_run_updates_history_instead_of_duplicating(self):
        run_fetch(FakeLaravel(COMPANIES), self.http, sleep=no_sleep)
        run_fetch(FakeLaravel(COMPANIES, outcome="refreshed"), self.http, sleep=no_sleep)
        self.assertEqual(FetchedJob.objects.get().outcome, "refreshed")
        self.assertEqual(Run.objects.filter(kind=Run.FETCH).count(), 2)

    def test_dry_run_sends_nothing(self):
        laravel = FakeLaravel(COMPANIES)
        run = run_fetch(laravel, self.http, dry_run=True, sleep=no_sleep)
        self.assertTrue(run.dry_run)
        self.assertEqual(laravel.pushed_jobs, [])
        self.assertFalse(FetchedJob.objects.exists())

    @override_settings(INCLUDE_UNKNOWN_LOCATION=True)
    def test_unknown_location_can_be_included(self):
        http = FakeHttp({"https://boards-api.greenhouse.io/v1/boards/acme/jobs": FakeResponse(200, {"jobs": [
            {"id": 9, "title": "Ops", "absolute_url": "https://boards.greenhouse.io/acme/jobs/9", "location": {"name": ""}},
        ]})})
        laravel = FakeLaravel([COMPANIES[0]])
        run_fetch(laravel, http, sleep=no_sleep)
        self.assertEqual(len(laravel.pushed_jobs[0]["jobs"]), 1)

    def test_laravel_failure_marks_run_failed(self):
        class DownLaravel(FakeLaravel):
            def companies(self):
                raise RuntimeError("site down")

        with self.assertRaises(RuntimeError):
            run_fetch(DownLaravel(), self.http, sleep=no_sleep)
        run = Run.objects.get()
        self.assertFalse(run.ok)
        self.assertIsNotNone(run.finished_at)
        self.assertIn("site down", run.errors[0]["error"])


class ProbeTests(TestCase):
    def test_classification_matches_postings_check(self):
        cases = [
            (FakeResponse(200, "<h1>Apply now</h1>"), "alive"),
            (FakeResponse(404), "dead"),
            (FakeResponse(410), "dead"),
            (FakeResponse(200, "<p>This job is <b>no longer accepting applications</b>.</p>"), "dead"),
            (FakeResponse(403), "unknown"),
            (FakeResponse(999), "unknown"),
            (FakeResponse(503), "unknown"),
            (requests.ConnectionError(), "unknown"),
            (requests.Timeout(), "unknown"),
        ]
        for response, expected in cases:
            result, reason = probe(FakeHttp({"https://e.com": response}), "https://e.com/job")
            self.assertEqual(result, expected, reason)


class LinkCheckRunTests(TestCase):
    def test_checks_every_posting_and_reports_results(self):
        laravel = FakeLaravel(postings=[
            {"id": "a", "title": "Alive", "apply_url": "https://e.com/alive"},
            {"id": "d", "title": "Dead", "apply_url": "https://e.com/dead"},
        ])
        http = FakeHttp({"https://e.com/alive": FakeResponse(200, "ok"), "https://e.com/dead": FakeResponse(404)})

        run = run_link_check(laravel, http, sleep=no_sleep)

        [results] = laravel.pushed_checks
        self.assertEqual([(r["id"], r["result"]) for r in results], [("a", "alive"), ("d", "dead")])
        self.assertTrue(run.ok)
        self.assertEqual(run.stats["checked"], 2)
        self.assertEqual([e["id"] for e in run.errors], ["d"])
