from __future__ import annotations

import os
from typing import Any

from google.auth.exceptions import GoogleAuthError
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from ..config import Settings

SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"


class GoogleSheetsExportError(RuntimeError):
    pass


class GoogleSheetsExporter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.spreadsheet_id = settings.google_sheets_spreadsheet_id
        self.range_name = settings.google_sheets_range
        self.credentials_file = settings.google_sheets_credentials_file

    def append_rows(self, headers: list[str], rows: list[list[Any]]) -> int:
        if not rows:
            return 0
        if not self.credentials_file:
            raise GoogleSheetsExportError(
                "Missing GOOGLE_SHEETS_CREDENTIALS_FILE. Add a service account JSON file path to .env."
            )
        if not os.path.exists(self.credentials_file):
            raise GoogleSheetsExportError(
                f"Google Sheets credential file not found: {self.credentials_file}"
            )

        try:
            service = self._build_service()
            range_name = self.range_name or self._default_range(service)
            self._ensure_header(service, range_name, headers)
            updated_rows = self._write_after_last_row(service, range_name, rows)
        except HttpError as exc:
            raise GoogleSheetsExportError(self._format_http_error(exc)) from exc

        if updated_rows < len(rows):
            raise GoogleSheetsExportError(
                f"Google Sheets only confirmed {updated_rows} of {len(rows)} rows."
            )

        return updated_rows

    def _build_service(self):
        try:
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_file,
                scopes=[SHEETS_SCOPE],
            )
            return build("sheets", "v4", credentials=credentials, cache_discovery=False)
        except (GoogleAuthError, OSError, ValueError) as exc:
            raise GoogleSheetsExportError(
                "Could not load the Google Sheets service account credentials."
            ) from exc

    def _default_range(self, service) -> str:
        spreadsheet = service.spreadsheets().get(
            spreadsheetId=self.spreadsheet_id,
            fields="sheets.properties.title",
        ).execute()
        sheets = spreadsheet.get("sheets", [])
        if not sheets:
            raise GoogleSheetsExportError("No sheets were found in the target spreadsheet.")
        sheet_title = sheets[0]["properties"]["title"]
        return f"{self._quote_sheet_name(sheet_title)}!A:R"

    def _ensure_header(self, service, range_name: str, headers: list[str]) -> None:
        first_row_range = self._first_row_range(range_name)
        existing = service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range=first_row_range,
        ).execute()
        if existing.get("values"):
            return

        service.spreadsheets().values().update(
            spreadsheetId=self.spreadsheet_id,
            range=first_row_range,
            valueInputOption="RAW",
            body={"values": [headers]},
        ).execute()

    def _write_after_last_row(self, service, range_name: str, rows: list[list[Any]]) -> int:
        existing = service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range=range_name,
        ).execute()
        existing_rows = existing.get("values", [])
        next_row = self._first_available_row_number(existing_rows)
        target_range = self._row_range(range_name, next_row, len(rows))

        service.spreadsheets().values().update(
            spreadsheetId=self.spreadsheet_id,
            range=target_range,
            valueInputOption="RAW",
            body={"values": rows},
        ).execute()

        return self._verified_written_row_count(service, target_range, rows)

    def _verified_written_row_count(
        self, service, target_range: str, expected_rows: list[list[Any]]
    ) -> int:
        response = service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range=target_range,
        ).execute()
        actual_rows = response.get("values", [])
        expected_count = len(expected_rows)

        if len(actual_rows) < expected_count:
            raise GoogleSheetsExportError(
                "Google Sheets accepted the request, but the rows were not found afterward."
            )

        for expected, actual in zip(expected_rows, actual_rows, strict=False):
            if self._normalized_row(expected) != self._normalized_row(actual):
                raise GoogleSheetsExportError(
                    "Google Sheets wrote different data than the app sent."
                )

        return expected_count

    def _normalized_row(self, row: list[Any]) -> list[str]:
        return ["" if value is None else str(value) for value in row]

    def _first_available_row_number(self, values: list[list[Any]]) -> int:
        for index, row in enumerate(values[1:], start=2):
            if not self._has_lead_data(row):
                return index
        return max(2, len(values) + 1)

    def _has_lead_data(self, row: list[Any]) -> bool:
        lead_columns = row[:16]
        return any(str(cell).strip() for cell in lead_columns)

    def _row_range(self, range_name: str, start_row: int, row_count: int) -> str:
        sheet_name, start_col, end_col = self._parse_range_parts(range_name)
        end_row = start_row + row_count - 1
        return f"{sheet_name}!{start_col}{start_row}:{end_col}{end_row}"

    def _parse_range_parts(self, range_name: str) -> tuple[str, str, str]:
        if "!" in range_name:
            sheet_name, coordinates = range_name.split("!", 1)
        else:
            sheet_name = "'Sheet1'"
            coordinates = range_name

        start_coordinate, end_coordinate = coordinates.split(":", 1)
        start_col = self._column_letters(start_coordinate)
        end_col = self._column_letters(end_coordinate)
        return sheet_name, start_col, end_col

    def _column_letters(self, coordinate: str) -> str:
        letters = "".join(char for char in coordinate if char.isalpha())
        return letters or "A"

    def _first_row_range(self, range_name: str) -> str:
        if "!" not in range_name:
            return "A1:R1"
        sheet_name = range_name.split("!", 1)[0]
        return f"{sheet_name}!A1:R1"

    def _quote_sheet_name(self, sheet_name: str) -> str:
        escaped = sheet_name.replace("'", "''")
        return f"'{escaped}'"

    def _format_http_error(self, exc: HttpError) -> str:
        if exc.resp.status in {401, 403}:
            return (
                "Google Sheets rejected the request. Share the target sheet with the "
                "service account email and make sure Google Sheets API is enabled."
            )
        return f"Google Sheets export failed: {exc}"
