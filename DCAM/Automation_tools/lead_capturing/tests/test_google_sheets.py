from lead_capture.config import Settings
from lead_capture.services.google_sheets import GoogleSheetsExporter


class FakeRequest:
    def __init__(self, response: dict | None = None) -> None:
        self.response = response or {}

    def execute(self) -> dict:
        return self.response


class FakeValues:
    def __init__(self) -> None:
        self.append_calls = []
        self.get_calls = []
        self.update_calls = []

    def get(self, **kwargs):
        self.get_calls.append(kwargs)
        if kwargs["range"] == "'Leads'!A2:R2":
            return FakeRequest({"values": [["Alpha Law", "alpha@example.com"]]})
        return FakeRequest({"values": [["business_name", "email"]]})

    def update(self, **kwargs):
        self.update_calls.append(kwargs)
        return FakeRequest()

    def append(self, **kwargs):
        self.append_calls.append(kwargs)
        return FakeRequest()


class FakeSpreadsheets:
    def __init__(self, values: FakeValues) -> None:
        self._values = values

    def values(self) -> FakeValues:
        return self._values


class FakeService:
    def __init__(self) -> None:
        self.values_api = FakeValues()
        self.spreadsheets_api = FakeSpreadsheets(self.values_api)

    def spreadsheets(self) -> FakeSpreadsheets:
        return self.spreadsheets_api


def test_google_sheets_exporter_writes_to_first_empty_row_after_header(monkeypatch, tmp_path):
    credentials_file = tmp_path / "service-account.json"
    credentials_file.write_text("{}", encoding="utf-8")
    settings = Settings(
        google_maps_api_key="fake-key",
        google_sheets_spreadsheet_id="sheet-123",
        google_sheets_credentials_file=str(credentials_file),
        google_sheets_range="'Leads'!A:R",
    )
    exporter = GoogleSheetsExporter(settings)
    fake_service = FakeService()
    monkeypatch.setattr(exporter, "_build_service", lambda: fake_service)

    count = exporter.append_rows(
        headers=["business_name", "email"],
        rows=[["Alpha Law", "alpha@example.com"]],
    )

    assert count == 1
    assert fake_service.values_api.append_calls == []
    assert fake_service.values_api.update_calls == [
        {
            "spreadsheetId": "sheet-123",
            "range": "'Leads'!A2:R2",
            "valueInputOption": "RAW",
            "body": {"values": [["Alpha Law", "alpha@example.com"]]},
        }
    ]


def test_first_available_row_ignores_leftover_source_status_only_rows(tmp_path):
    credentials_file = tmp_path / "service-account.json"
    credentials_file.write_text("{}", encoding="utf-8")
    settings = Settings(
        google_maps_api_key="fake-key",
        google_sheets_credentials_file=str(credentials_file),
    )
    exporter = GoogleSheetsExporter(settings)

    row_with_only_source_and_status = [""] * 16 + ["Google Places", "New"]

    assert exporter._first_available_row_number(
        [["business_name"], row_with_only_source_and_status]
    ) == 2
