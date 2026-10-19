from __future__ import annotations

from collections.abc import Iterable
from html import unescape
import re
from urllib.parse import urldefrag, unquote, urljoin, urlparse

from bs4 import BeautifulSoup
import requests

from ..config import Settings
from ..models import WebsiteCheckResult

EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.IGNORECASE)
OBFUSCATED_EMAIL_PATTERN = re.compile(
    r"([A-Z0-9._%+\-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\s+at\s+)\s*"
    r"([A-Z0-9.\-]+?)\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+)\s*([A-Z]{2,})",
    re.IGNORECASE,
)
SUSPICIOUS_MARKERS = {
    "domain for sale": "Parked or for-sale domain",
    "buy this domain": "Parked or for-sale domain",
    "coming soon": "Website says coming soon",
    "under construction": "Website says under construction",
    "this domain is parked": "Parked or for-sale domain",
    "site not found": "Website content looks broken",
    "account suspended": "Website appears suspended",
}
CONTACT_HINTS = (
    "contact",
    "about",
    "team",
    "get-in-touch",
    "contact-us",
    "contactus",
    "support",
    "email",
    "enquiry",
    "enquire",
    "privacy",
    "customer-care",
    "careers",
)
COMMON_EMAIL_PATHS = (
    "/contact",
    "/contact-us",
    "/contactus",
    "/about",
    "/about-us",
    "/support",
    "/enquiry",
    "/privacy-policy",
)


class WebsiteAnalyzer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0 Safari/537.36"
            )
        }

    def inspect(self, website_url: str | None) -> WebsiteCheckResult:
        if not website_url:
            return WebsiteCheckResult(
                status="No website",
                issue="No website listed on the business profile",
            )

        try:
            response = self._fetch(website_url)
        except requests.RequestException as exc:
            return WebsiteCheckResult(
                status="Issue detected",
                issue=f"Request failed: {self._short_error(exc)}",
            )

        status = "Working"
        issue = "No issue detected"

        if response.status_code >= 400:
            status = "Issue detected"
            issue = f"HTTP {response.status_code}"
        elif marker := self._find_suspicious_marker(response.text):
            status = "Issue detected"
            issue = marker

        emails = self._collect_public_emails(response)
        return WebsiteCheckResult(
            status=status,
            issue=issue,
            final_url=response.url,
            http_status=response.status_code,
            emails=emails,
        )

    def _fetch(self, url: str) -> requests.Response:
        response = requests.get(
            url,
            headers=self.headers,
            allow_redirects=True,
            timeout=self.settings.request_timeout_seconds,
        )
        return response

    def _collect_public_emails(self, response: requests.Response) -> list[str]:
        emails = set(self._extract_emails(response.text))

        for candidate_url in self._candidate_pages(response.text, response.url):
            try:
                candidate_response = self._fetch(candidate_url)
            except requests.RequestException:
                continue
            emails.update(self._extract_emails(candidate_response.text))

        return sorted(emails)

    def _candidate_pages(self, html: str, base_url: str) -> list[str]:
        soup = BeautifulSoup(html, "html.parser")
        base_host = urlparse(base_url).netloc.lower()
        urls: list[str] = []

        for anchor in soup.find_all("a", href=True):
            href = anchor.get("href", "")
            text = anchor.get_text(" ", strip=True).lower()
            href_lower = href.lower()
            if not any(hint in href_lower or hint in text for hint in CONTACT_HINTS):
                continue

            absolute_url = self._clean_url(urljoin(base_url, href))
            parsed = urlparse(absolute_url)
            if parsed.scheme not in {"http", "https"}:
                continue
            if parsed.netloc.lower() != base_host:
                continue
            if absolute_url not in urls:
                urls.append(absolute_url)
            if len(urls) >= self.settings.max_email_pages:
                break

        for path in COMMON_EMAIL_PATHS:
            absolute_url = self._clean_url(urljoin(base_url, path))
            if absolute_url not in urls:
                urls.append(absolute_url)
            if len(urls) >= self.settings.max_email_pages:
                break

        return urls

    def _clean_url(self, value: str) -> str:
        url, _fragment = urldefrag(value)
        return url

    def _extract_emails(self, html: str) -> Iterable[str]:
        soup = BeautifulSoup(html, "html.parser")
        found = set()

        for anchor in soup.find_all("a", href=True):
            href = anchor.get("href", "")
            if href.lower().startswith("mailto:"):
                email = unquote(href.split(":", 1)[1].split("?", 1)[0].strip())
                if self._looks_like_email(email):
                    found.add(email.lower())
            found.update(self._cloudflare_emails(anchor))

        combined_text = " ".join(
            [soup.get_text(" ", strip=True), " ".join(self._all_link_targets(soup))]
        )
        decoded_text = unquote(unescape(combined_text))
        for match in EMAIL_PATTERN.findall(decoded_text):
            cleaned = match.strip(".,;:!?)(").lower()
            if self._looks_like_email(cleaned):
                found.add(cleaned)

        for local, domain, tld in OBFUSCATED_EMAIL_PATTERN.findall(decoded_text):
            email = f"{local}@{domain}.{tld}".lower()
            if self._looks_like_email(email):
                found.add(email)

        return sorted(found)

    def _cloudflare_emails(self, anchor) -> set[str]:
        encoded_values = []
        href = anchor.get("href", "")
        if "/cdn-cgi/l/email-protection#" in href:
            encoded_values.append(href.rsplit("#", 1)[-1])
        data_cfemail = anchor.get("data-cfemail")
        if data_cfemail:
            encoded_values.append(data_cfemail)

        emails = set()
        for encoded_value in encoded_values:
            decoded = self._decode_cloudflare_email(encoded_value)
            if decoded and self._looks_like_email(decoded):
                emails.add(decoded.lower())
        return emails

    def _decode_cloudflare_email(self, encoded_value: str) -> str | None:
        try:
            key = int(encoded_value[:2], 16)
            return "".join(
                chr(int(encoded_value[index : index + 2], 16) ^ key)
                for index in range(2, len(encoded_value), 2)
            )
        except (ValueError, TypeError):
            return None

    def _all_link_targets(self, soup: BeautifulSoup) -> Iterable[str]:
        for anchor in soup.find_all("a", href=True):
            yield anchor.get("href", "")

    def _looks_like_email(self, value: str) -> bool:
        lowered = value.lower()
        if "example.com" in lowered:
            return False
        return bool(EMAIL_PATTERN.fullmatch(lowered))

    def _find_suspicious_marker(self, html: str) -> str | None:
        lowered = html.lower()
        for marker, reason in SUSPICIOUS_MARKERS.items():
            if marker in lowered:
                return reason
        return None

    def _short_error(self, exc: requests.RequestException) -> str:
        message = str(exc).strip()
        return message or exc.__class__.__name__
