from lead_capture.config import Settings
from lead_capture.services.google_places import GooglePlacesClient


class FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = ""

    def json(self) -> dict:
        return self._payload


def test_search_businesses_fetches_all_pages():
    client = GooglePlacesClient(Settings(google_maps_api_key="fake-key"))
    payloads = [
        FakeResponse(
            {
                "places": [
                    {
                        "id": "1",
                        "displayName": {"text": "Alpha Law"},
                        "formattedAddress": "Addr 1",
                    }
                ],
                "nextPageToken": "page-2",
            }
        ),
        FakeResponse(
            {
                "places": [
                    {
                        "id": "2",
                        "displayName": {"text": "Beta Law"},
                        "formattedAddress": "Addr 2",
                    }
                ]
            }
        ),
    ]
    seen_payloads: list[dict] = []

    def fake_post(url: str, json: dict, timeout: int):
        seen_payloads.append(json)
        return payloads.pop(0)

    client.session.post = fake_post

    results = client.search_businesses("law firms", "Mumbai")

    assert [place.name for place in results] == ["Alpha Law", "Beta Law"]
    assert seen_payloads == [
        {"textQuery": "law firms in Mumbai", "pageSize": 20, "languageCode": "en"},
        {
            "textQuery": "law firms in Mumbai",
            "pageSize": 20,
            "languageCode": "en",
            "pageToken": "page-2",
        },
    ]
