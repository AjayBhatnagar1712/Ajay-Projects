from lead_capture.config import Settings
from lead_capture.services.website_analyzer import WebsiteAnalyzer


def test_extracts_mailto_and_visible_emails():
    analyzer = WebsiteAnalyzer(Settings(google_maps_api_key="fake-key"))
    html = """
    <html>
        <body>
            <a href="mailto:hello@example.org">Email us</a>
            <p>Support: support@firm.com</p>
        </body>
    </html>
    """

    emails = list(analyzer._extract_emails(html))

    assert emails == ["hello@example.org", "support@firm.com"]


def test_extracts_obfuscated_emails():
    analyzer = WebsiteAnalyzer(Settings(google_maps_api_key="fake-key"))
    html = """
    <html>
        <body>
            <p>Contact info [at] firm [dot] com</p>
            <p>Sales: sales(at)firm(dot)com</p>
        </body>
    </html>
    """

    emails = list(analyzer._extract_emails(html))

    assert emails == ["info@firm.com", "sales@firm.com"]


def test_candidate_pages_include_common_contact_paths():
    analyzer = WebsiteAnalyzer(Settings(google_maps_api_key="fake-key", max_email_pages=4))

    candidates = analyzer._candidate_pages("<html></html>", "https://firm.com")

    assert "https://firm.com/contact" in candidates
    assert "https://firm.com/contact-us" in candidates


def test_marks_missing_website_without_fetch():
    analyzer = WebsiteAnalyzer(Settings(google_maps_api_key="fake-key"))

    result = analyzer.inspect(None)

    assert result.status == "No website"
    assert "No website listed" in result.issue
