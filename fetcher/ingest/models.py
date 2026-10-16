"""
History only. The Laravel site owns the real data (companies, postings, the
moderation queue); these tables just record what the fetcher saw and did, so
it can be browsed in the Django admin.
"""

from django.db import models
from django.utils import timezone


class Run(models.Model):
    FETCH = "fetch"
    CHECK = "check"
    KINDS = [(FETCH, "Fetch jobs"), (CHECK, "Link check")]

    kind = models.CharField(max_length=10, choices=KINDS)
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    ok = models.BooleanField(default=False, help_text="False if the run crashed or Laravel refused the results.")
    dry_run = models.BooleanField(default=False)
    stats = models.JSONField(default=dict, blank=True)
    errors = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.get_kind_display()} · {timezone.localtime(self.started_at):%d %b %Y %H:%M}"


class FetchedJob(models.Model):
    """One Kolkata job seen on a company's board. Outcome is what Laravel did with it last time."""

    OUTCOMES = [
        ("queued", "Queued for moderation"),
        ("refreshed", "Already on the map — refreshed"),
        ("skipped", "Skipped (already reviewed or closed)"),
        ("unknown_company", "Company not found on the site"),
    ]

    provider = models.CharField(max_length=20)
    company_slug = models.CharField(max_length=255)
    external_id = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    apply_url = models.URLField(max_length=2048)
    location = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True)
    exp_bucket = models.CharField(max_length=10, blank=True)
    work_mode = models.CharField(max_length=10, blank=True)
    posted_at = models.DateField(null=True, blank=True)
    first_seen_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)
    outcome = models.CharField(max_length=20, choices=OUTCOMES, blank=True)

    class Meta:
        ordering = ["-last_seen_at"]
        constraints = [
            models.UniqueConstraint(fields=["provider", "company_slug", "external_id"], name="fetched_job_unique"),
        ]

    def __str__(self):
        return f"{self.title} ({self.company_slug})"
