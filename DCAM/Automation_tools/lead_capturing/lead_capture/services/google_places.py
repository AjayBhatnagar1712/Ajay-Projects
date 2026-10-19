from __future__ import annotations

from typing import Any

import requests

from ..config import Settings
from ..models import PlaceResult


class PlacesAPIError(RuntimeError):
    pass


class GooglePlacesClient:
    SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
    FIELD_MASK = ",".join(
        [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.websiteUri",
            "places.nationalPhoneNumber",
            "places.businessStatus",
            "places.googleMapsUri",
            "places.primaryTypeDisplayName",
            "places.types",
            "places.addressComponents",
            "places.rating",
            "places.userRatingCount",
            "places.editorialSummary",
            "nextPageToken",
        ]
    )

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": settings.google_maps_api_key,
                "X-Goog-FieldMask": self.FIELD_MASK,
            }
        )

    def search_businesses(self, business_type: str, area: str) -> list[PlaceResult]:
        text_query = f"{business_type} in {area}"
        results: list[PlaceResult] = []
        page_token: str | None = None
        seen_ids: set[str] = set()

        while True:
            payload: dict[str, Any] = {
                "textQuery": text_query,
                "pageSize": 20,
                "languageCode": "en",
            }
            if page_token:
                payload["pageToken"] = page_token

            response = self.session.post(
                self.SEARCH_URL,
                json=payload,
                timeout=self.settings.request_timeout_seconds,
            )

            if response.status_code >= 400:
                raise PlacesAPIError(self._format_api_error(response))

            data = response.json()
            for place in data.get("places", []):
                parsed = self._parse_place(place, business_type)
                if parsed.place_id in seen_ids:
                    continue
                seen_ids.add(parsed.place_id)
                results.append(parsed)

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return results

    def _parse_place(self, place: dict[str, Any], business_type: str | None = None) -> PlaceResult:
        display_name = place.get("displayName", {}).get("text", "Unnamed business")
        address_parts = self._parse_address_components(place.get("addressComponents", []))
        return PlaceResult(
            place_id=place.get("id", display_name),
            name=display_name,
            address=place.get("formattedAddress", "Address not available"),
            website=place.get("websiteUri"),
            phone_number=place.get("nationalPhoneNumber"),
            business_status=place.get("businessStatus"),
            maps_url=place.get("googleMapsUri"),
            business_type=business_type,
            category=self._parse_category(place),
            area=address_parts["area"],
            city=address_parts["city"],
            state=address_parts["state"],
            country=address_parts["country"],
            rating=place.get("rating"),
            reviews_count=place.get("userRatingCount"),
            business_description=place.get("editorialSummary", {}).get("text"),
        )

    def _parse_category(self, place: dict[str, Any]) -> str | None:
        primary_type = place.get("primaryTypeDisplayName", {}).get("text")
        if primary_type:
            return primary_type

        types = place.get("types", [])
        if not types:
            return None
        return types[0].replace("_", " ").title()

    def _parse_address_components(self, components: list[dict[str, Any]]) -> dict[str, str | None]:
        values = {
            "area": None,
            "city": None,
            "state": None,
            "country": None,
        }

        for component in components:
            types = set(component.get("types", []))
            text = component.get("longText") or component.get("shortText")
            if not text:
                continue

            if values["area"] is None and types & {
                "sublocality",
                "sublocality_level_1",
                "neighborhood",
                "route",
            }:
                values["area"] = text
            if values["city"] is None and types & {
                "locality",
                "postal_town",
                "administrative_area_level_3",
            }:
                values["city"] = text
            if values["state"] is None and "administrative_area_level_1" in types:
                values["state"] = text
            if values["country"] is None and "country" in types:
                values["country"] = text

        return values

    def _format_api_error(self, response: requests.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            payload = {"error": {"message": response.text}}
        message = payload.get("error", {}).get("message", "Unknown Places API error")
        return f"Google Places request failed with HTTP {response.status_code}: {message}"
