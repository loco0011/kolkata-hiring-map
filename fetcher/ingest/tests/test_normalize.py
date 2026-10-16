from datetime import date

from django.test import SimpleTestCase

from ingest.normalize import NormalizedJob, guess_exp_bucket, in_kolkata, parse_date, should_keep, work_mode_from


def job(locations=(), work_mode=None):
    return NormalizedJob(external_id="1", title="X", apply_url="https://e.com/1", locations=list(locations), work_mode=work_mode)


class KolkataFilterTests(SimpleTestCase):
    def test_matches_city_and_localities(self):
        for loc in ["Kolkata, West Bengal, India", "Calcutta", "Salt Lake Sector V", "New Town, Rajarhat", "HOWRAH"]:
            self.assertTrue(in_kolkata(job([loc])), loc)

    def test_other_cities_do_not_match(self):
        for loc in ["Bengaluru, India", "Durgapur, West Bengal", "Remote - India", "Gariahat-less town",
                    "Salt Lake City, UT", "SaltLake City"]:
            self.assertFalse(in_kolkata(job([loc])), loc)

    def test_any_of_several_locations_counts(self):
        self.assertTrue(in_kolkata(job(["Pune", "Kolkata"])))

    def test_no_location_is_unknown(self):
        self.assertIsNone(in_kolkata(job([])))
        self.assertIsNone(in_kolkata(job(["  "])))

    def test_remote_is_inferred_from_location_text(self):
        self.assertEqual(job(["Remote, EMEA"]).work_mode, "remote")
        self.assertEqual(job(["India (Work from home)"]).work_mode, "remote")
        self.assertIsNone(job(["Kolkata / Remote"]).work_mode)
        self.assertEqual(job(["Remote"], work_mode="hybrid").work_mode, "hybrid")  # explicit field wins

    def test_should_keep_respects_unknown_and_remote_switches(self):
        nowhere, remote = job([]), job(["India"], work_mode="remote")
        self.assertFalse(should_keep(nowhere, include_unknown=False, include_remote=False))
        self.assertTrue(should_keep(nowhere, include_unknown=True, include_remote=False))
        self.assertFalse(should_keep(remote, include_unknown=False, include_remote=False))
        self.assertTrue(should_keep(remote, include_unknown=False, include_remote=True))
        self.assertTrue(should_keep(job(["Kolkata"]), include_unknown=False, include_remote=False))


class GuessingTests(SimpleTestCase):
    def test_exp_bucket_from_title(self):
        cases = {
            "Software Engineering Intern": "Intern",
            "Summer Internship – Data": "Intern",
            "Graduate Trainee Engineer": "Fresher",
            "Senior Backend Engineer": "3+ yr",
            "Sr. Accountant": "3+ yr",
            "Engineering Manager": "3+ yr",
            "Junior Designer": "1-3 yr",
            "Backend Engineer": None,
            "International Sales": None,  # "intern" inside a word doesn't count
        }
        for title, bucket in cases.items():
            self.assertEqual(guess_exp_bucket(title), bucket, title)

    def test_work_mode_spellings(self):
        self.assertEqual(work_mode_from("On-site"), "onsite")
        self.assertEqual(work_mode_from("OnSite"), "onsite")
        self.assertEqual(work_mode_from("TELECOMMUTE"), "remote")
        self.assertEqual(work_mode_from("Hybrid"), "hybrid")
        self.assertIsNone(work_mode_from("unspecified"))
        self.assertIsNone(work_mode_from(None))

    def test_parse_date(self):
        self.assertEqual(parse_date("2026-10-01"), date(2026, 10, 1))
        self.assertEqual(parse_date("2026-10-01T09:30:00.000Z"), date(2026, 10, 1))
        self.assertEqual(parse_date("2026-10-01 09:30:00 UTC"), date(2026, 10, 1))
        self.assertEqual(parse_date(1790000000000), date(2026, 9, 21))
        self.assertIsNone(parse_date("soon"))
        self.assertIsNone(parse_date(None))
