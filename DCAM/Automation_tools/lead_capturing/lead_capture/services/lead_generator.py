from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from ..config import Settings
from ..models import Lead, PlaceResult
from .google_places import GooglePlacesClient
from .website_analyzer import WebsiteAnalyzer


class LeadGenerationService:
    def __init__(self, settings: Settings) -> None:
        self.places_client = GooglePlacesClient(settings)
        self.website_analyzer = WebsiteAnalyzer(settings)

    def search(self, business_type: str, area: str) -> tuple[list[Lead], list[Lead]]:
        places = self.places_client.search_businesses(
            business_type=business_type,
            area=area,
        )
        leads = self._build_leads(places)
        flagged = [lead for lead in leads if lead.is_flagged]
        return leads, self._sort_flagged(flagged)

    def search_contacts(self, business_types: list[str], area: str) -> list[Lead]:
        places = self._search_unique_places(business_types, area)
        return sorted(self._build_leads(places), key=lambda lead: lead.name.lower())

    def _search_unique_places(self, business_types: list[str], area: str) -> list[PlaceResult]:
        places: list[PlaceResult] = []
        seen: set[str] = set()

        for business_type in business_types:
            for place in self.places_client.search_businesses(business_type, area):
                key = place.place_id or f"{place.name}|{place.address}".lower()
                if key in seen:
                    continue
                seen.add(key)
                places.append(place)

        return places

    def _build_leads(self, places: list[PlaceResult]) -> list[Lead]:
        worker_count = min(6, max(1, len(places)))
        with ThreadPoolExecutor(max_workers=worker_count) as pool:
            leads = list(pool.map(self._build_single_lead, places))
        return leads

    def _build_single_lead(self, place: PlaceResult) -> Lead:
        website_result = self.website_analyzer.inspect(place.website)
        return Lead(
            name=place.name,
            address=place.address,
            phone_number=place.phone_number,
            website=place.website,
            email_addresses=website_result.emails,
            maps_url=place.maps_url,
            business_status=place.business_status,
            website_status=website_result.status,
            website_issue=website_result.issue,
            checked_url=website_result.final_url,
            http_status=website_result.http_status,
            business_type=place.business_type,
            category=place.category,
            area=place.area,
            city=place.city,
            state=place.state,
            country=place.country,
            rating=place.rating,
            reviews_count=place.reviews_count,
            business_description=place.business_description,
        )

    def _sort_flagged(self, leads: list[Lead]) -> list[Lead]:
        def sort_key(lead: Lead) -> tuple[int, str]:
            if not lead.website:
                return (0, lead.name.lower())
            return (1, lead.name.lower())

        return sorted(leads, key=sort_key)
