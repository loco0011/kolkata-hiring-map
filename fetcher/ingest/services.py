import logging
import time
from collections import defaultdict

from django.conf import settings
from django.utils import timezone

from .linkcheck import probe
from .models import FetchedJob, Run
from .normalize import exp_bucket_for, should_keep
from .sources import ATS_SOURCES, SOURCES, valid_token
from .web import Robots

log = logging.getLogger(__name__)


def plan(companies, *, provider=None, company=None):
    """Which source and target to scan for each company: its ATS board if set, else its careers page."""
    targets = []
    for c in companies:
        if company and c["slug"] != company:
            continue
        if c.get("ats_provider") in ATS_SOURCES and c.get("ats_token"):
            source, target = c["ats_provider"], c["ats_token"]
        elif c.get("careers_url"):
            source, target = "jsonld", c["careers_url"]
        else:
            continue
        if provider and source != provider:
            continue
        targets.append((c["slug"], source, target))
    return targets


def run_fetch(client, http, *, provider=None, company=None, dry_run=False, delay=None, sleep=time.sleep) -> Run:
    run = Run.objects.create(kind=Run.FETCH, dry_run=dry_run)
    delay = settings.FETCH_DELAY_SECONDS if delay is None else delay
    robots = Robots(http)

    found = defaultdict(list)       # source → [(slug, NormalizedJob)]
    scanned = defaultdict(int)      # source → companies scanned
    errors = defaultdict(list)      # source → [{company, error}]
    seen_total = filtered_out = 0

    try:
        targets = plan(client.companies(), provider=provider, company=company)

        for i, (slug, source, target) in enumerate(targets):
            if i:
                sleep(delay)
            scanned[source] += 1
            if source != "jsonld" and not valid_token(target):
                errors[source].append({"company": slug, "error": f"invalid board token {target!r}"})
                continue
            try:
                jobs = SOURCES[source](http, target, robots)
            except Exception as exc:  # one broken board must not stop the run
                log.warning("%s (%s): %s", slug, source, exc)
                errors[source].append({"company": slug, "error": f"{type(exc).__name__}: {exc}"[:300]})
                continue

            seen_urls = set()
            for job in jobs:
                seen_total += 1
                if job.apply_url in seen_urls:
                    continue
                seen_urls.add(job.apply_url)
                if should_keep(job, include_unknown=settings.INCLUDE_UNKNOWN_LOCATION,
                               include_remote=settings.INCLUDE_REMOTE):
                    found[source].append((slug, job))
                else:
                    filtered_out += 1

        outcomes = defaultdict(int)
        for source in scanned:
            items = found[source]
            payload = [_payload(slug, job) for slug, job in items]
            if dry_run:
                for slug, job in items:
                    log.info("[dry run] %s · %s · %s · %s", source, slug, job.title, job.location)
                continue
            response = client.push_jobs(source, payload, companies_scanned=scanned[source], errors=errors[source])
            for result in response["results"]:
                slug, job = items[result["index"]]
                outcomes[result["outcome"]] += 1
                _remember(source, slug, job, result["outcome"])

        run.ok = True
        run.stats = {
            "companies": sum(scanned.values()),
            "jobs_seen": seen_total,
            "kept": sum(len(v) for v in found.values()),
            "filtered_out": filtered_out,
            **outcomes,
            "by_source": {s: {"companies": scanned[s], "jobs": len(found[s])} for s in scanned},
        }
    except Exception as exc:
        log.exception("fetch run failed")
        errors["run"].append({"error": f"{type(exc).__name__}: {exc}"[:500]})
        raise
    finally:
        run.errors = [{"source": s, **e} for s, errs in errors.items() for e in errs]
        run.finished_at = timezone.now()
        run.save()
    return run


def run_link_check(client, http, *, delay=None, sleep=time.sleep) -> Run:
    run = Run.objects.create(kind=Run.CHECK)
    delay = settings.CHECK_DELAY_SECONDS if delay is None else delay
    try:
        postings = client.live_postings()
        results = []
        for i, posting in enumerate(postings):
            if i:
                sleep(delay)
            result, reason = probe(http, posting["apply_url"])
            log.info("%-7s %s  (%s)", result.upper(), posting["title"][:50], reason)
            results.append({"id": posting["id"], "result": result, "reason": reason})

        response = client.push_checks(results)
        run.ok = True
        run.stats = {"checked": len(results), **response["counts"]}
        run.errors = [r for r in results if r["result"] != "alive"]
    except Exception as exc:
        log.exception("link check failed")
        run.errors = [*run.errors, {"error": f"{type(exc).__name__}: {exc}"[:500]}]
        raise
    finally:
        run.finished_at = timezone.now()
        run.save()
    return run


def _payload(slug, job):
    return {
        "company_slug": slug,
        "title": job.title,
        "apply_url": job.apply_url,
        "location": job.location or None,
        "department": job.department or None,
        "exp_bucket": exp_bucket_for(job),
        "work_mode": job.work_mode,
        "posted_at": job.posted_at.isoformat() if job.posted_at else None,
    }


def _remember(source, slug, job, outcome):
    now = timezone.now()
    fields = {
        "title": job.title,
        "apply_url": job.apply_url,
        "location": job.location,
        "department": job.department,
        "exp_bucket": exp_bucket_for(job) or "",
        "work_mode": job.work_mode or "",
        "posted_at": job.posted_at,
        "last_seen_at": now,
        "outcome": outcome,
    }
    FetchedJob.objects.update_or_create(
        provider=source, company_slug=slug, external_id=job.external_id[:255],
        defaults=fields,
        create_defaults={**fields, "first_seen_at": now},  # create_defaults replaces defaults on insert
    )
