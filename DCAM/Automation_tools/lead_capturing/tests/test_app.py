from base64 import b64decode
import csv
from io import StringIO

from app import app
from lead_capture.models import Lead
from lead_capture.routes import (
    PENDING_SHEET_EXPORTS,
    _csv_download_mailing_data,
    _decode_csv_payload,
    _parse_business_types,
    _store_sheet_export,
)


def test_home_page_loads():
    client = app.test_client()

    response = client.get("/")

    assert response.status_code == 200
    assert b"Market Capturing Tools" in response.data
    assert b"Business Contact Finder" in response.data
    assert b"Website Gap Finder" in response.data


def test_website_gap_page_loads():
    client = app.test_client()

    response = client.get("/website-gap-finder")

    assert response.status_code == 200
    assert b"Find businesses that need a better website presence." in response.data
    assert b"Max Results" not in response.data


def test_business_contact_finder_page_loads():
    client = app.test_client()

    response = client.get("/business-contact-finder")

    assert response.status_code == 200
    assert b"Collect contact details for potential client businesses." in response.data


def test_parse_business_types_accepts_commas_semicolons_and_newlines():
    parsed = _parse_business_types("law firms, dentists\nclinics; law firms")

    assert parsed == ["law firms", "dentists", "clinics"]


def test_mailing_csv_uses_requested_columns():
    lead = Lead(
        name="A Plus Holidays",
        address="Delhi, India",
        phone_number="09811333197",
        website="https://aplusholidays.co.in",
        email_addresses=["sales@example.com", "info@example.com"],
        maps_url="https://maps.example.com/a-plus",
        business_status="OPERATIONAL",
        website_status="Working",
        website_issue="No issue detected",
        checked_url="https://aplusholidays.co.in",
        http_status=200,
        business_type="Travel Agency",
        category="Travel Agency",
        area="Pitampura",
        city="Delhi",
        state="Delhi",
        country="India",
        rating=4.5,
        reviews_count=125,
        business_description="Tour operator in Delhi.",
    )

    decoded = _decode_csv(_csv_download_mailing_data([lead], "Delhi"))

    assert decoded["fieldnames"] == [
        "business_name",
        "owner_or_contact_name",
        "email",
        "phone",
        "industry",
        "category",
        "area",
        "city",
        "state",
        "country",
        "address",
        "website",
        "google_maps_link",
        "rating",
        "reviews_count",
        "business_description",
        "source",
        "status",
    ]
    assert len(decoded["rows"]) == 2
    assert decoded["rows"][0]["business_name"] == "A Plus Holidays"
    assert decoded["rows"][1]["business_name"] == "A Plus Holidays"
    assert decoded["rows"][0]["owner_or_contact_name"] == ""
    assert decoded["rows"][0]["email"] == "sales@example.com"
    assert decoded["rows"][1]["email"] == "info@example.com"
    assert decoded["rows"][0]["phone"] == "09811333197"
    assert decoded["rows"][1]["phone"] == "09811333197"
    assert decoded["rows"][0]["industry"] == "Travel Agency"
    assert decoded["rows"][0]["category"] == "Travel Agency"
    assert decoded["rows"][0]["area"] == "Pitampura"
    assert decoded["rows"][0]["city"] == "Delhi"
    assert decoded["rows"][0]["state"] == "Delhi"
    assert decoded["rows"][0]["country"] == "India"
    assert decoded["rows"][0]["address"] == "Delhi, India"
    assert decoded["rows"][0]["website"] == "https://aplusholidays.co.in"
    assert decoded["rows"][0]["google_maps_link"] == "https://maps.example.com/a-plus"
    assert decoded["rows"][0]["rating"] == "4.5"
    assert decoded["rows"][0]["reviews_count"] == "125"
    assert decoded["rows"][0]["business_description"] == "Tour operator in Delhi."
    assert decoded["rows"][0]["source"] == "Google Places"
    assert decoded["rows"][0]["status"] == "New"


def test_mailing_csv_skips_phone_only_leads_without_email():
    lead = Lead(
        name="Phone Only Business",
        address="Delhi, India",
        phone_number="011 1234 5678",
        website=None,
        email_addresses=[],
        maps_url="https://maps.example.com/phone-only",
        business_status="OPERATIONAL",
        website_status="No website",
        website_issue="No website listed",
        checked_url=None,
        http_status=None,
        business_type="Law Firm",
    )

    assert _csv_download_mailing_data([lead], "Delhi") is None


def test_mailing_csv_skips_blank_email_rows():
    lead_with_email = Lead(
        name="Email Business",
        address="Delhi, India",
        phone_number="011 9999 9999",
        website="https://email.example",
        email_addresses=["first@firm.com"],
        maps_url="https://maps.example.com/email",
        business_status="OPERATIONAL",
        website_status="Working",
        website_issue="No issue detected",
        checked_url="https://email.example",
        http_status=200,
        business_type="Law Firm",
    )
    lead_without_email = Lead(
        name="Phone Only Business",
        address="Delhi, India",
        phone_number="011 1234 5678",
        website=None,
        email_addresses=[],
        maps_url="https://maps.example.com/phone-only",
        business_status="OPERATIONAL",
        website_status="No website",
        website_issue="No website listed",
        checked_url=None,
        http_status=None,
        business_type="Law Firm",
    )

    decoded = _decode_csv(
        _csv_download_mailing_data([lead_without_email, lead_with_email], "Delhi")
    )

    assert len(decoded["rows"]) == 1
    assert decoded["rows"][0]["business_name"] == "Email Business"
    assert decoded["rows"][0]["email"] == "first@firm.com"


def test_decode_csv_payload_returns_headers_and_sheet_rows():
    lead = Lead(
        name="A Plus Holidays",
        address="Delhi, India",
        phone_number="09811333197",
        website="https://aplusholidays.co.in",
        email_addresses=["sales@example.com"],
        maps_url="https://maps.example.com/a-plus",
        business_status="OPERATIONAL",
        website_status="Working",
        website_issue="No issue detected",
        checked_url="https://aplusholidays.co.in",
        http_status=200,
        business_type="Travel Agency",
    )

    headers, rows = _decode_csv_payload(_csv_download_mailing_data([lead], "Delhi"))

    assert headers[0] == "business_name"
    assert rows[0][0] == "A Plus Holidays"
    assert rows[0][2] == "sales@example.com"


def test_store_sheet_export_keeps_rows_server_side():
    lead = Lead(
        name="A Plus Holidays",
        address="Delhi, India",
        phone_number="09811333197",
        website="https://aplusholidays.co.in",
        email_addresses=["sales@example.com"],
        maps_url="https://maps.example.com/a-plus",
        business_status="OPERATIONAL",
        website_status="Working",
        website_issue="No issue detected",
        checked_url="https://aplusholidays.co.in",
        http_status=200,
        business_type="Travel Agency",
    )

    token = _store_sheet_export([lead], "Delhi")

    assert token is not None
    headers, rows = PENDING_SHEET_EXPORTS.pop(token)
    assert headers[0] == "business_name"
    assert rows[0][0] == "A Plus Holidays"
    assert rows[0][2] == "sales@example.com"


def _decode_csv(encoded_value: str | None) -> dict[str, list]:
    assert encoded_value is not None
    decoded = b64decode(encoded_value).decode("utf-8")
    reader = csv.DictReader(StringIO(decoded))
    return {
        "fieldnames": reader.fieldnames,
        "rows": list(reader),
    }
