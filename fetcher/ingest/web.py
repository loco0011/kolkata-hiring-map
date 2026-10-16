import logging
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import requests
from django.conf import settings

log = logging.getLogger(__name__)

TIMEOUT = 20


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": settings.FETCHER_USER_AGENT,
        "Accept": "application/json, text/html;q=0.9, */*;q=0.5",
    })
    return session


class Robots:
    """robots.txt cache, used before reading a company's own careers page (ATS APIs are public APIs)."""

    def __init__(self, http):
        self.http = http
        self._parsers: dict[str, RobotFileParser | None] = {}

    def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._parsers:
            self._parsers[origin] = self._load(origin)
        parser = self._parsers[origin]
        return True if parser is None else parser.can_fetch(settings.FETCHER_USER_AGENT, url)

    def _load(self, origin: str) -> RobotFileParser | None:
        try:
            response = self.http.get(f"{origin}/robots.txt", timeout=TIMEOUT)
        except requests.RequestException:
            return None  # can't read it → behave like a browser and carry on
        if response.status_code >= 400:
            return None
        parser = RobotFileParser()
        parser.parse(response.text.splitlines())
        return parser
