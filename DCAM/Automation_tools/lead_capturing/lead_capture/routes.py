from __future__ import annotations

from base64 import b64decode, b64encode
import csv
from io import StringIO
import re
from uuid import uuid4

from flask import Blueprint, render_template, request

from .config import ConfigError, get_settings
from .models import Lead
from .services.google_places import PlacesAPIError
from .services.google_sheets import GoogleSheetsExporter, GoogleSheetsExportError
from .services.lead_generator import LeadGenerationService

bp = Blueprint("main", __name__)
PENDING_SHEET_EXPORTS: dict[str, tuple[list[str], list[list[str]]]] = {}


@bp.route("/")
def home():
    return render_template("home.html")


@bp.route("/website-gap-finder", methods=["GET", "POST"])
def website_gap_finder():
    form_data = {
        "business_type": "",
        "area": "",
    }
    all_results: list[Lead] = []
    flagged_results: list[Lead] = []
    error_message: str | None = None
    search_performed = False

    if request.method == "POST":
        search_performed = True
        form_data["business_type"] = request.form.get("business_type", "").strip()
        form_data["area"] = request.form.get("area", "").strip()

        if not form_data["business_type"] or not form_data["area"]:
            error_message = "Enter both a business type and an area."
        else:
            try:
                service = LeadGenerationService(get_settings())
                all_results, flagged_results = service.search(
                    business_type=form_data["business_type"],
                    area=form_data["area"],
                )
            except ConfigError as exc:
                error_message = str(exc)
            except PlacesAPIError as exc:
                error_message = str(exc)

    return render_template(
        "website_gap_finder.html",
        form_data=form_data,
        all_results=all_results,
        flagged_results=flagged_results,
        flagged_csv=_csv_download_data(flagged_results),
        all_csv=_csv_download_data(all_results),
        error_message=error_message,
        search_performed=search_performed,
        summary=_build_summary(all_results, flagged_results),
    )


@bp.route("/business-contact-finder", methods=["GET", "POST"])
def business_contact_finder():
    form_data = {
        "business_types": "",
        "area": "",
    }
    contact_results: list[Lead] = []
    error_message: str | None = None
    search_performed = False
    parsed_types: list[str] = []

    if request.method == "POST":
        search_performed = True
        form_data["business_types"] = request.form.get("business_types", "").strip()
        form_data["area"] = request.form.get("area", "").strip()
        parsed_types = _parse_business_types(form_data["business_types"])

        if not parsed_types or not form_data["area"]:
            error_message = "Enter at least one business type and an area."
        else:
            try:
                service = LeadGenerationService(get_settings())
                contact_results = service.search_contacts(
                    business_types=parsed_types,
                    area=form_data["area"],
                )
            except ConfigError as exc:
                error_message = str(exc)
            except PlacesAPIError as exc:
                error_message = str(exc)

    return render_template(
        "business_contact_finder.html",
        form_data=form_data,
        contact_results=contact_results,
        mailing_csv=_csv_download_mailing_data(contact_results, form_data["area"]),
        sheet_export_token=_store_sheet_export(contact_results, form_data["area"]),
        error_message=error_message,
        search_performed=search_performed,
        parsed_types=parsed_types,
        summary=_build_contact_summary(contact_results),
    )


@bp.route("/business-contact-finder/send-to-sheet", methods=["POST"])
def send_business_contacts_to_sheet():
    export_token = request.form.get("export_token", "").strip()
    csv_data = request.form.get("csv_data", "").strip()

    if export_token:
        payload = PENDING_SHEET_EXPORTS.get(export_token)
        if payload is None:
            return render_template(
                "sheet_export_result.html",
                success=False,
                message=(
                    "The prepared sheet export expired. Go back, run the search again, "
                    "then send it to Google Sheets."
                ),
            )
        headers, rows = payload
    elif csv_data:
        try:
            headers, rows = _decode_csv_payload(csv_data)
        except ValueError as exc:
            return render_template(
                "sheet_export_result.html",
                success=False,
                message=str(exc),
            )
    else:
        return render_template(
            "sheet_export_result.html",
            success=False,
            message="No CSV data was available to send. Run a search first, then send the results.",
        )

    try:
        sent_count = GoogleSheetsExporter(get_settings()).append_rows(headers, rows)
    except (ConfigError, GoogleSheetsExportError) as exc:
        return render_template(
            "sheet_export_result.html",
            success=False,
            message=str(exc),
        )

    if export_token:
        PENDING_SHEET_EXPORTS.pop(export_token, None)

    return render_template(
        "sheet_export_result.html",
        success=True,
        message=f"Sent {sent_count} email rows to the first visible empty rows in Google Sheets.",
    )


def _parse_business_types(raw_value: str) -> list[str]:
    values = [part.strip() for part in re.split(r"[,;\n]+", raw_value)]
    return list(dict.fromkeys(value for value in values if value))


def _build_summary(all_results: list[Lead], flagged_results: list[Lead]) -> dict[str, int]:
    no_website_count = sum(1 for lead in flagged_results if not lead.website)
    website_issue_count = sum(1 for lead in flagged_results if lead.website)
    email_found_count = sum(1 for lead in all_results if lead.email_addresses)
    return {
        "total_results": len(all_results),
        "flagged_results": len(flagged_results),
        "no_website_count": no_website_count,
        "website_issue_count": website_issue_count,
        "email_found_count": email_found_count,
    }


def _build_contact_summary(results: list[Lead]) -> dict[str, int]:
    return {
        "total_results": len(results),
        "phone_found_count": sum(1 for lead in results if lead.phone_number),
        "email_found_count": sum(1 for lead in results if lead.email_addresses),
        "website_found_count": sum(1 for lead in results if lead.website),
        "no_website_count": sum(1 for lead in results if not lead.website),
    }


def _csv_download_data(leads: list[Lead]) -> str | None:
    if not leads:
        return None

    fieldnames = [
        "business_type",
        "name",
        "address",
        "phone_number",
        "email_addresses",
        "website",
        "website_status",
        "website_issue",
        "lead_reason",
        "maps_url",
        "business_status",
        "checked_url",
        "http_status",
    ]
    rows = [lead.to_csv_row() for lead in leads]
    return _csv_download_rows(rows, fieldnames)


def _csv_download_mailing_data(leads: list[Lead], fallback_area: str) -> str | None:
    rows = _mailing_rows(leads, fallback_area)
    return _csv_download_rows(rows, _mailing_fieldnames())


def _store_sheet_export(leads: list[Lead], fallback_area: str) -> str | None:
    rows = _mailing_rows(leads, fallback_area)
    if not rows:
        return None

    token = uuid4().hex
    headers = _mailing_fieldnames()
    PENDING_SHEET_EXPORTS[token] = (
        headers,
        [[_sheet_cell(row.get(header)) for header in headers] for row in rows],
    )
    return token


def _sheet_cell(value: str | int | float | None) -> str:
    return "" if value is None else str(value)


def _csv_download_rows(
    rows: list[dict[str, str | int | float | None]], fieldnames: list[str]
) -> str | None:
    if not rows:
        return None

    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

    return b64encode(output.getvalue().encode("utf-8")).decode("ascii")


def _decode_csv_payload(encoded_value: str) -> tuple[list[str], list[list[str]]]:
    try:
        decoded = b64decode(encoded_value).decode("utf-8")
    except Exception as exc:
        raise ValueError("The CSV data could not be decoded.") from exc

    reader = csv.DictReader(StringIO(decoded))
    headers = reader.fieldnames or []
    if headers != _mailing_fieldnames():
        raise ValueError("The CSV format does not match the configured Google Sheet format.")

    rows = [[row.get(header, "") for header in headers] for row in reader]
    if not rows:
        raise ValueError("There are no rows to send to the Google Sheet.")
    return headers, rows


def _mailing_rows(leads: list[Lead], fallback_area: str) -> list[dict[str, str | int | float | None]]:
    email_rows: list[dict[str, str | int | float | None]] = []
    for lead in leads:
        for email in lead.email_addresses:
            email_rows.append(_mailing_row(lead, fallback_area, email))
    return email_rows


def _mailing_row(
    lead: Lead, fallback_area: str, email: str
) -> dict[str, str | int | float | None]:
    return {
        "business_name": lead.name,
        "owner_or_contact_name": "",
        "email": email,
        "phone": lead.phone_number or "",
        "industry": lead.business_type_display,
        "category": lead.category_display,
        "area": lead.area or fallback_area,
        "city": lead.city or "",
        "state": lead.state or "",
        "country": lead.country or "",
        "address": lead.address,
        "website": lead.website or "",
        "google_maps_link": lead.maps_url or "",
        "rating": lead.rating,
        "reviews_count": lead.reviews_count,
        "business_description": lead.business_description or "",
        "source": "Google Places",
        "status": "New",
    }


def _mailing_fieldnames() -> list[str]:
    return [
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
