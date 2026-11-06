"""Safe URL fetching: SSRF protection, timeouts, response-size limits, redirect re-validation."""
import ipaddress, socket
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from ..config import get_settings


class UnsafeURL(ValueError):
    pass


class FetchError(RuntimeError):
    pass


def _check_ip(ip: str):
    a = ipaddress.ip_address(ip)
    if a.is_private or a.is_loopback or a.is_link_local or a.is_multicast or a.is_reserved or a.is_unspecified:
        raise UnsafeURL("URL resolves to a non-public address")


def validate_public_url(url: str) -> str:
    p = urlparse(url.strip())
    if p.scheme not in ("http", "https"):
        raise UnsafeURL("Only http and https URLs are allowed")
    if not p.hostname:
        raise UnsafeURL("URL has no host")
    if p.username or p.password:
        raise UnsafeURL("Credentials in URLs are not allowed")
    if p.port and p.port not in (80, 443, 8080, 8443):
        raise UnsafeURL("Port not allowed")
    try:
        _check_ip(p.hostname)  # literal IP
    except ValueError as e:
        if isinstance(e, UnsafeURL):
            raise
        try:
            infos = socket.getaddrinfo(p.hostname, p.port or (443 if p.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
        except socket.gaierror:
            raise UnsafeURL("Host could not be resolved")
        for info in infos:
            _check_ip(info[4][0])
    return p.geturl()


def extract_text(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "noscript", "nav", "footer", "form", "svg"]):
        t.decompose()
    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    if not title:
        h = soup.find("h1")
        title = h.get_text(" ", strip=True) if h else ""
    text = " ".join(soup.get_text(" ", strip=True).split())
    return title[:300], text[:12000]


async def fetch_bytes(url: str, transport: httpx.AsyncBaseTransport | None = None, kinds: tuple = ("html", "text")) -> tuple[str, str, bytes, str | None]:
    """Fetch with SSRF validation on every hop, size cap and timeout. Returns (final_url, content_type, body, encoding)."""
    s = get_settings()
    cur = validate_public_url(url)
    async with httpx.AsyncClient(timeout=s.fetch_timeout, follow_redirects=False, transport=transport,
                                 headers={"User-Agent": "StrategicMemoryLab/1.0 (+research)"}) as c:
        for _ in range(4):
            try:
                async with c.stream("GET", cur) as r:
                    if r.is_redirect:
                        cur = validate_public_url(urljoin(cur, r.headers.get("location", "")))
                        continue
                    if r.status_code >= 400:
                        raise FetchError(f"Source returned HTTP {r.status_code}")
                    ctype = r.headers.get("content-type", "")
                    if not any(k in ctype for k in kinds):
                        raise FetchError("Source has an unsupported content type")
                    buf = b""
                    async for chunk in r.aiter_bytes():
                        buf += chunk
                        if len(buf) > s.fetch_max_bytes:
                            buf = buf[: s.fetch_max_bytes]
                            break
                    return cur, ctype, buf, r.encoding
            except httpx.TimeoutException:
                raise FetchError("Source timed out")
            except httpx.HTTPError as e:
                raise FetchError(f"Could not fetch source ({type(e).__name__})")
        raise FetchError("Too many redirects")


async def fetch_page(url: str, transport: httpx.AsyncBaseTransport | None = None) -> tuple[str, str, str]:
    final, _, buf, enc = await fetch_bytes(url, transport, ("html", "text"))
    title, text = extract_text(buf.decode(enc or "utf-8", errors="replace"))
    if not text:
        raise FetchError("No readable text found on the page")
    return final, title, text
