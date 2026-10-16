"""Freshteam, Darwinbox, Keka, Zoho Recruit — fixtures trimmed from real responses (Oct 2026)."""

import html
import json
from datetime import date

from django.test import SimpleTestCase

from ingest.normalize import NormalizedJob, exp_bucket_for, exp_bucket_from_years
from ingest.sources import darwinbox, freshteam, keka, zohorecruit

from .fakes import FakeHttp, FakeResponse

FRESHTEAM = {
    "jobs": [
        {"id": 5000080043, "title": " Java Developer-Kolkata", "unique_id": "ppxSxfeaQeBR", "deleted": False,
         "closing_date": None, "created_at": "2022-06-07T09:10:28.000Z", "remote": False,
         "branch_id": 1, "job_role_id": 10, "preferred_remote_job_locations": ""},
        {"id": 2, "title": "Old Role", "unique_id": "closedAAAA", "deleted": False,
         "closing_date": "2026-01-01", "branch_id": 1, "job_role_id": 10},
        {"id": 3, "title": "Removed", "unique_id": "deletedBBB", "deleted": True, "branch_id": 1},
        {"id": 4, "title": "Remote Writer", "unique_id": "remoteCCCC", "deleted": False, "remote": True,
         "branch_id": 2, "job_role_id": 99},
    ],
    "branches": [
        {"id": 1, "name": "Kolkata", "city": "Kolkata", "state": "West Bengal", "location": "Kolkata, India"},
        {"id": 2, "name": "Mumbai", "city": "Mumbai", "state": "Maharashtra", "location": "Mumbai, India"},
    ],
    "job_roles": [{"id": 10, "name": "Technology & Innovation Centre"}],
}


class FreshteamTests(SimpleTestCase):
    def test_parses_widget_feed(self):
        http = FakeHttp({"https://indusnet.freshteam.com/hire/widgets/jobs.json": FakeResponse(200, FRESHTEAM)})
        jobs = freshteam.fetch(http, "indusnet", today=date(2026, 10, 16))

        self.assertEqual([j.external_id for j in jobs], ["ppxSxfeaQeBR", "remoteCCCC"], "closed + deleted dropped")
        java, writer = jobs
        self.assertEqual(java.title, "Java Developer-Kolkata")
        self.assertEqual(java.apply_url, "https://indusnet.freshteam.com/jobs/ppxSxfeaQeBR")
        self.assertEqual(java.locations, ["Kolkata, India", "Kolkata, West Bengal"])
        self.assertEqual(java.department, "Technology & Innovation Centre")
        self.assertEqual(java.posted_at, date(2022, 6, 7))
        self.assertEqual((writer.work_mode, writer.department), ("remote", ""))


def darwinbox_page(items, total):
    return FakeResponse(200, {"status": "success", "data": items, "job_counts": total})


def darwinbox_job(job_id, **extra):
    return {
        "id": job_id, "title": f"Role {job_id}", "department_name": "Sales & Marketing",
        "tool_tip_locations": ["Salt Lake Sector V, Kolkata, West Bengal\r, India"],
        "posted_on": 1790000000, "experience_from": "3", "is_remote": 0, **extra,
    }


class DarwinboxTests(SimpleTestCase):
    URL = "https://acme.darwinbox.in/ms/candidateapi/job/alljobs"

    def test_parses_and_pages_until_all_jobs_are_read(self):
        page1 = [darwinbox_job(f"a{i}") for i in range(50)]
        page2 = [darwinbox_job("b1", experience_from="0", title=None, designation_display_name="Graduate Trainee")]
        http = FakeHttp({self.URL: [darwinbox_page(page1, 51), darwinbox_page(page2, 51)]})

        jobs = darwinbox.fetch(http, "acme")

        self.assertEqual(len(jobs), 51)
        self.assertEqual(len(http.calls), 2)
        first, last = jobs[0], jobs[-1]
        self.assertEqual(first.apply_url, "https://acme.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a0")
        self.assertEqual(first.locations, ["Salt Lake Sector V, Kolkata, West Bengal , India"])
        self.assertEqual((first.department, first.exp_bucket), ("Sales & Marketing", "3+ yr"))
        self.assertEqual(first.posted_at, date(2026, 9, 21))  # epoch seconds, not ms
        self.assertEqual((last.title, last.exp_bucket), ("Graduate Trainee", "Fresher"))

    def test_sends_careers_page_headers_cloudflare_expects(self):
        http = FakeHttp({self.URL: darwinbox_page([], 0)})
        darwinbox.fetch(http, "acme")
        headers = http.last_kwargs["headers"]
        self.assertEqual(headers["Origin"], "https://acme.darwinbox.in")
        self.assertIn("/careers/allJobs", headers["Referer"])

    def test_challenge_page_or_error_raises(self):
        with self.assertRaises(darwinbox.DarwinboxError):
            darwinbox.fetch(FakeHttp({self.URL: FakeResponse(200, "<html>Attention Required! | Cloudflare</html>")}), "acme")
        with self.assertRaises(darwinbox.DarwinboxError):
            darwinbox.fetch(FakeHttp({self.URL: FakeResponse(200, {"status": "error", "data": {"message": "Invalid subdomain"}})}), "acme")


KEKA = [
    {"id": 125652, "title": "Technical Program Manager", "departmentName": "Operations & Delivery",
     "jobLocations": [{"id": 1, "name": "Kolkata", "city": "Kolkata", "state": "WB", "countryName": "India"}],
     "experience": "4-8", "publishedOn": "2026-09-10T06:11:34.05Z"},
    {"id": 157633, "title": "HR & Admin Executive", "departmentName": "People",
     "jobLocations": [{"id": 2, "name": "Bengaluru", "city": "Bengaluru", "state": "KA", "countryName": "India"}],
     "experience": "2-4", "publishedOn": "2026-08-01T00:00:00Z"},
]


class KekaTests(SimpleTestCase):
    def test_parses_active_jobs(self):
        http = FakeHttp({"https://mihup.keka.com/careers/api/jobs/default/active": FakeResponse(200, KEKA)})
        tpm, hr = keka.fetch(http, "mihup")
        self.assertEqual(tpm.apply_url, "https://mihup.keka.com/careers/jobdetails/125652")
        self.assertEqual(tpm.locations, ["Kolkata, WB, India"])
        self.assertEqual((tpm.department, tpm.exp_bucket, tpm.posted_at), ("Operations & Delivery", "3+ yr", date(2026, 9, 10)))
        self.assertEqual(hr.exp_bucket, "1-3 yr")


def zoho_page(jobs):
    value = html.escape(json.dumps(jobs), quote=True)
    return (f'<html><head><title>Jobs at Acme</title></head><body>'
            f'<input type="hidden" value="{value}" id="jobs"><input type="hidden" value="{{}}" id="meta"></body></html>')


ZOHO = [
    {"id": "83063000000557032", "Posting_Title": "Sales Executive – Kolkata", "City": "Kolkata", "State": "West Bengal",
     "Country": "India", "Date_Opened": "2026-09-18", "Work_Experience": "2 to 4 Year", "Publish": True, "Remote_Job": False},
    {"id": "2", "Posting_Title": "Site Executive", "City": "NA", "State": "Haryana", "Country": "India", "Publish": True},
    {"id": "3", "Posting_Title": "Unpublished", "City": "Kolkata", "Publish": False},
    {"id": "4", "Job_Opening_Name": "Remote Analyst", "City": None, "Remote_Job": True, "Publish": True},
]


class ZohoRecruitTests(SimpleTestCase):
    def test_parses_embedded_job_list(self):
        http = FakeHttp({"https://acme.zohorecruit.in/jobs/Careers": FakeResponse(200, zoho_page(ZOHO))})
        jobs = zohorecruit.fetch(http, "acme.zohorecruit.in")

        self.assertEqual([j.external_id for j in jobs], ["83063000000557032", "2", "4"])
        sales, site, remote = jobs
        self.assertEqual(sales.apply_url, "https://acme.zohorecruit.in/jobs/Careers/83063000000557032/Sales-Executive-Kolkata")
        self.assertEqual(sales.locations, ["Kolkata, West Bengal, India"])
        self.assertEqual((sales.exp_bucket, sales.posted_at), ("1-3 yr", date(2026, 9, 18)))
        self.assertEqual(site.locations, ["Haryana, India"], "'NA' city dropped")
        self.assertEqual((remote.title, remote.work_mode, remote.locations), ("Remote Analyst", "remote", []))

    def test_token_must_be_a_zohorecruit_host(self):
        for bad in ["acme", "acme.zohorecruit.in.evil.com", "evil.com", "acme.zohorecruit.xyz"]:
            with self.assertRaises(zohorecruit.ZohoRecruitError, msg=bad):
                zohorecruit.fetch(FakeHttp(), bad)

    def test_missing_site_raises_instead_of_returning_nothing(self):
        page = "<html><title>Page does not exist</title></html>"
        with self.assertRaises(zohorecruit.ZohoRecruitError):
            zohorecruit.fetch(FakeHttp({"https://nope.zohorecruit.com/jobs/Careers": FakeResponse(200, page)}), "nope.zohorecruit.com")


class ExperienceTests(SimpleTestCase):
    def test_bucket_from_years(self):
        cases = {"0": "Fresher", "0-1": "Fresher", "0.5": "Fresher", "1-3": "1-3 yr", "2 to 4 Year": "1-3 yr",
                 "3 - 6 Years": "3+ yr", 15: "3+ yr", "": None, None: None, "Not specified": None}
        for value, bucket in cases.items():
            self.assertEqual(exp_bucket_from_years(value), bucket, value)

    def test_board_experience_beats_title_guess_but_intern_title_wins(self):
        def job(title, bucket):
            return NormalizedJob(external_id="1", title=title, apply_url="https://e.com", exp_bucket=bucket)

        self.assertEqual(exp_bucket_for(job("Backend Engineer", "1-3 yr")), "1-3 yr")
        self.assertEqual(exp_bucket_for(job("Senior Engineer", "1-3 yr")), "1-3 yr")
        self.assertEqual(exp_bucket_for(job("Marketing Intern", "3+ yr")), "Intern")
        self.assertEqual(exp_bucket_for(job("Senior Engineer", None)), "3+ yr")
