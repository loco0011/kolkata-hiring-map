from django.contrib import admin

from .models import FetchedJob, Run


class ReadOnlyAdmin(admin.ModelAdmin):
    """Written only by the fetch_jobs / check_links commands."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Run)
class RunAdmin(ReadOnlyAdmin):
    list_display = ["started_at", "kind", "ok", "dry_run", "summary", "error_count"]
    list_filter = ["kind", "ok", "dry_run"]

    @admin.display(description="Stats")
    def summary(self, obj):
        return ", ".join(f"{k}: {v}" for k, v in obj.stats.items() if not isinstance(v, dict))

    @admin.display(description="Errors")
    def error_count(self, obj):
        return len(obj.errors)


@admin.register(FetchedJob)
class FetchedJobAdmin(ReadOnlyAdmin):
    list_display = ["title", "company_slug", "provider", "location", "exp_bucket", "outcome", "last_seen_at"]
    list_filter = ["provider", "outcome", "exp_bucket", "work_mode"]
    search_fields = ["title", "company_slug", "location"]
