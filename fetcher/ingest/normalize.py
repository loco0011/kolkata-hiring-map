"""The common shape every source adapter returns, plus the Kolkata filter and light guessing."""

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

# Kolkata and the localities its jobs get listed under. Matched as whole words
# against the job's location text, case-insensitively.
KOLKATA_TERMS = [
    "kolkata", "calcutta", "salt lake", "saltlake", "bidhannagar", "sector v", "sector-v",
    "new town", "newtown", "rajarhat", "howrah", "park street", "esplanade", "ballygunge",
    "tollygunge", "behala", "garia", "jadavpur", "dum dum", "barasat", "sonarpur",
]
# Places elsewhere that contain a Kolkata locality name; blanked out before matching.
NOT_KOLKATA = re.compile(r"\bsalt\s*lake\s+city\b", re.IGNORECASE)
_KOLKATA_TERMS_RE = re.compile(r"\b(" + "|".join(re.escape(t) for t in KOLKATA_TERMS) + r")\b", re.IGNORECASE)
_REMOTE_RE = re.compile(r"\b(remote|anywhere|work from home|wfh)\b", re.IGNORECASE)


def _mentions_kolkata(text: str) -> bool:
    return bool(_KOLKATA_TERMS_RE.search(NOT_KOLKATA.sub(" ", text)))


EXP_BUCKETS = ["Intern", "Fresher", "1-3 yr", "3+ yr"]
WORK_MODES = ["onsite", "hybrid", "remote"]


@dataclass
class NormalizedJob:
    external_id: str
    title: str
    apply_url: str
    locations: list[str] = field(default_factory=list)
    department: str = ""
    work_mode: str | None = None  # one of WORK_MODES
    posted_at: date | None = None
    exp_bucket: str | None = None  # from the board's own experience field, when it has one

    def __post_init__(self):
        # Many boards (Greenhouse especially) only say "Remote" in the location text.
        # "Kolkata / Remote" stays unset — that's a Kolkata job the moderator can classify.
        if self.work_mode is None:
            text = " | ".join(loc for loc in self.locations if loc)
            if _REMOTE_RE.search(text) and not _mentions_kolkata(text):
                self.work_mode = "remote"

    @property
    def location(self) -> str:
        return self.locations[0] if self.locations else ""

    @property
    def is_remote(self) -> bool:
        return self.work_mode == "remote"


def in_kolkata(job: NormalizedJob) -> bool | None:
    """True/False from the location text, None when the posting gives no location."""
    text = " | ".join(loc for loc in job.locations if loc)
    if not text.strip():
        return None
    return _mentions_kolkata(text)


def should_keep(job: NormalizedJob, *, include_unknown: bool, include_remote: bool) -> bool:
    where = in_kolkata(job)
    if where is True:
        return True
    if job.is_remote and include_remote:
        return True
    return where is None and include_unknown


def guess_exp_bucket(title: str) -> str | None:
    """A first guess for the moderator; None when the title doesn't say."""
    t = title.lower()
    if re.search(r"\bintern(ship)?s?\b", t):
        return "Intern"
    if re.search(r"\b(fresher|freshers|graduate|trainee|entry[- ]level)\b", t):
        return "Fresher"
    if re.search(r"\b(senior|sr\.?|lead|principal|staff|manager|head|director|architect|vp)\b", t):
        return "3+ yr"
    if re.search(r"\b(junior|jr\.?|associate)\b", t):
        return "1-3 yr"
    return None


def exp_bucket_for(job: NormalizedJob) -> str | None:
    """An internship title always wins; otherwise the board's experience field, else a title guess."""
    guessed = guess_exp_bucket(job.title)
    if guessed == "Intern":
        return guessed
    return job.exp_bucket or guessed


def exp_bucket_from_years(value) -> str | None:
    """'0-2', '3 - 6 Years', '2 to 4 Year', 5 → bucket from the minimum years; None if no number."""
    if value is None:
        return None
    match = re.search(r"\d+(\.\d+)?", str(value))
    if not match:
        return None
    years = float(match.group())
    if years < 1:
        return "Fresher"
    return "1-3 yr" if years < 3 else "3+ yr"


def work_mode_from(value) -> str | None:
    """Maps the many spellings sources use (On-site, OnSite, TELECOMMUTE, ...) onto WORK_MODES."""
    if not value:
        return None
    v = re.sub(r"[^a-z]", "", str(value).lower())
    if v in ("onsite", "office", "inoffice", "inperson"):
        return "onsite"
    if v == "hybrid":
        return "hybrid"
    if v in ("remote", "telecommute", "wfh", "workfromhome"):
        return "remote"
    return None


def parse_date(value, *, epoch_seconds=False) -> date | None:
    """ISO strings ('2026-10-01', '2026-10-01T09:00:00Z', '2026-10-01 09:00:00 UTC') or epoch
    milliseconds (seconds with epoch_seconds=True)."""
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value if epoch_seconds else value / 1000, tz=timezone.utc).date()
    match = re.match(r"(\d{4}-\d{2}-\d{2})", str(value).strip())
    if not match:
        return None
    try:
        return date.fromisoformat(match.group(1))
    except ValueError:
        return None


def clip(value, limit=255) -> str:
    return (str(value).strip() if value else "")[:limit]
