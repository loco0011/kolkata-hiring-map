from datetime import date

from django.test import SimpleTestCase

from ingest.sources import ashby, greenhouse, jsonld, lever, recruitee, valid_token, workable

from .fakes import FakeHttp, FakeResponse


class GreenhouseTests(SimpleTestCase):
    def test_parses_board(self):
        http = FakeHttp({"https://boards-api.greenhouse.io/v1/boards/acme/jobs": FakeResponse(200, {"jobs": [
            {"id": 11, "title": "Backend Engineer", "absolute_url": "https://boards.greenhouse.io/acme/jobs/11",
             "location": {"name": "Kolkata, India"}, "first_published": "2026-10-01T10:00:00-04:00"},
            {"id": 12, "title": "", "absolute_url": "https://x"},  # junk rows are dropped
        ]})})
        [j] = greenhouse.fetch(http, "acme")
        self.assertEqual((j.external_id, j.title, j.location), ("11", "Backend Engineer", "Kolkata, India"))
        self.assertEqual(j.posted_at, date(2026, 10, 1))

    def test_http_error_raises(self):
        http = FakeHttp({"https://boards-api.greenhouse.io": FakeResponse(404)})
        with self.assertRaises(Exception):
            greenhouse.fetch(http, "missing")


class LeverTests(SimpleTestCase):
    def test_parses_postings(self):
        http = FakeHttp({"https://api.lever.co/v0/postings/acme": FakeResponse(200, [
            {"id": "abc", "text": "Data Analyst", "hostedUrl": "https://jobs.lever.co/acme/abc",
             "categories": {"location": "Kolkata", "allLocations": ["Kolkata", "Pune"], "team": "Data"},
             "workplaceType": "hybrid", "createdAt": 1790000000000},
        ])})
        [j] = lever.fetch(http, "acme")
        self.assertEqual(j.locations, ["Kolkata", "Pune"])
        self.assertEqual((j.department, j.work_mode), ("Data", "hybrid"))


class AshbyTests(SimpleTestCase):
    def test_parses_listed_jobs_only(self):
        http = FakeHttp({"https://api.ashbyhq.com/posting-api/job-board/acme": FakeResponse(200, {"jobs": [
            {"id": "a1", "title": "PM", "jobUrl": "https://jobs.ashbyhq.com/acme/a1", "location": "Remote",
             "secondaryLocations": [{"location": "Kolkata"}], "isRemote": True, "publishedAt": "2026-09-30T00:00:00Z"},
            {"id": "a2", "title": "Hidden", "jobUrl": "https://jobs.ashbyhq.com/acme/a2", "isListed": False},
        ]})})
        [j] = ashby.fetch(http, "acme")
        self.assertEqual(j.locations, ["Remote", "Kolkata"])
        self.assertEqual(j.work_mode, "remote")


class WorkableTests(SimpleTestCase):
    def test_parses_widget_feed(self):
        http = FakeHttp({"https://apply.workable.com/api/v1/widget/accounts/acme": FakeResponse(200, {"jobs": [
            {"title": "QA Engineer", "shortcode": "ABC123", "url": "https://apply.workable.com/j/ABC123",
             "city": "Kolkata", "state": "West Bengal", "country": "India", "department": "QA",
             "telecommuting": False, "published_on": "2026-10-02"},
        ]})})
        [j] = workable.fetch(http, "acme")
        self.assertEqual((j.external_id, j.location), ("ABC123", "Kolkata, West Bengal, India"))
        self.assertIsNone(j.work_mode)


class RecruiteeTests(SimpleTestCase):
    def test_parses_published_offers(self):
        http = FakeHttp({"https://acme.recruitee.com/api/offers/": FakeResponse(200, {"offers": [
            {"id": 5, "title": "Designer", "careers_url": "https://acme.recruitee.com/o/designer", "status": "published",
             "location": "Kolkata, India", "hybrid": True, "published_at": "2026-10-03 08:00:00 UTC"},
            {"id": 6, "title": "Old", "careers_url": "https://acme.recruitee.com/o/old", "status": "closed"},
        ]})})
        [j] = recruitee.fetch(http, "acme")
        self.assertEqual((j.work_mode, j.posted_at), ("hybrid", date(2026, 10, 3)))


class TokenTests(SimpleTestCase):
    def test_only_plain_slugs_are_valid(self):
        self.assertTrue(valid_token("acme-corp_1"))
        for bad in ["", None, "evil.com/x", "a b", "../x", "x?y=1", "@host"]:
            self.assertFalse(valid_token(bad), bad)


PAGE = """
<html><head>
<script type="application/ld+json">{"@context": "https://schema.org", "@type": "Organization", "name": "Acme"}</script>
<script type='application/ld+json'>
{"@graph": [
  {"@type": "JobPosting", "title": "Sales Executive &amp; Lead", "url": "/jobs/sales", "datePosted": "2026-10-05",
   "identifier": {"@type": "PropertyValue", "value": "S-1"},
   "jobLocation": {"@type": "Place", "address": {"addressLocality": "Kolkata", "addressRegion": "WB",
                   "addressCountry": {"@type": "Country", "name": "India"}}}},
  {"@type": "JobPosting", "title": "Expired Role", "validThrough": "2026-01-01"},
  {"@type": ["JobPosting"], "title": "Remote Writer", "jobLocationType": "TELECOMMUTE"}
]}
</script>
<script type="application/ld+json">{ not json </script>
</head></html>
"""


class JsonLdTests(SimpleTestCase):
    def test_extracts_job_postings(self):
        jobs = jsonld.parse(PAGE, "https://acme.example/careers", today=date(2026, 10, 16))
        self.assertEqual([j.title for j in jobs], ["Sales Executive & Lead", "Remote Writer"])
        sales, writer = jobs
        self.assertEqual(sales.apply_url, "https://acme.example/jobs/sales")
        self.assertEqual(sales.external_id, "S-1")
        self.assertEqual(sales.locations, ["Kolkata, WB, India"])
        self.assertEqual(sales.posted_at, date(2026, 10, 5))
        self.assertEqual(writer.apply_url, "https://acme.example/careers")  # no url → the careers page
        self.assertEqual(writer.work_mode, "remote")

    def test_page_without_markup_yields_nothing(self):
        self.assertEqual(jsonld.parse("<html><body>Join us!</body></html>", "https://acme.example/careers"), [])

    def test_respects_robots_txt(self):
        class NoRobots:
            def allowed(self, url):
                return False

        http = FakeHttp({"https://acme.example/careers": FakeResponse(200, PAGE)})
        with self.assertRaises(jsonld.RobotsDisallowed):
            jsonld.fetch(http, "https://acme.example/careers", NoRobots())
        self.assertEqual(http.calls, [])
