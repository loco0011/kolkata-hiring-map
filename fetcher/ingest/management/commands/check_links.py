from django.core.management.base import BaseCommand, CommandError

from ingest.laravel import LaravelClient, LaravelError
from ingest.services import run_link_check
from ingest.web import make_session


class Command(BaseCommand):
    help = (
        "Re-check every live posting's link and report the results to the site, which closes "
        "postings dead two nights running. Replaces `php artisan postings:check` when LINK_CHECKER=python."
    )

    def add_arguments(self, parser):
        parser.add_argument("--delay", type=float, help="Seconds between requests (default CHECK_DELAY_SECONDS).")

    def handle(self, *args, **options):
        try:
            run = run_link_check(LaravelClient(), make_session(), delay=options["delay"])
        except LaravelError as exc:
            raise CommandError(str(exc)) from exc

        s = run.stats
        self.stdout.write(self.style.SUCCESS(
            f"{s['checked']} checked · {s.get('alive', 0)} alive · {s.get('dead', 0)} dead strike · "
            f"{s.get('unknown', 0)} unknown · {s.get('closed', 0)} closed"
        ))
