from django.core.management.base import BaseCommand, CommandError

from ingest.laravel import LaravelClient, LaravelError
from ingest.services import run_fetch
from ingest.sources import SOURCES
from ingest.web import make_session


class Command(BaseCommand):
    help = "Fetch Kolkata jobs from company ATS boards and careers pages, and queue new ones on the site's /dashboard."

    def add_arguments(self, parser):
        parser.add_argument("--provider", choices=sorted(SOURCES), help="Only scan companies using this source.")
        parser.add_argument("--company", metavar="SLUG", help="Only scan this company.")
        parser.add_argument("--dry-run", action="store_true", help="Fetch and print what was found; send nothing to the site.")
        parser.add_argument("--delay", type=float, help="Seconds between companies (default FETCH_DELAY_SECONDS).")

    def handle(self, *args, **options):
        try:
            run = run_fetch(
                LaravelClient(), make_session(),
                provider=options["provider"], company=options["company"],
                dry_run=options["dry_run"], delay=options["delay"],
            )
        except LaravelError as exc:
            raise CommandError(str(exc)) from exc

        stats = run.stats
        self.stdout.write(self.style.SUCCESS(
            f"{stats['companies']} companies scanned · {stats['jobs_seen']} jobs seen · "
            f"{stats['kept']} kept · {stats['filtered_out']} filtered out (not Kolkata)"
        ))
        if not run.dry_run:
            self.stdout.write(
                f"{stats.get('queued', 0)} queued for review · {stats.get('refreshed', 0)} already on the map (refreshed) · "
                f"{stats.get('skipped', 0)} skipped · {stats.get('unknown_company', 0)} unknown company"
            )
        for error in run.errors:
            self.stderr.write(self.style.WARNING(f"  {error.get('source')} · {error.get('company', '')}: {error['error']}"))
