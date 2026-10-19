from dataclasses import asdict, dataclass, field


@dataclass(slots=True)
class PlaceResult:
    place_id: str
    name: str
    address: str
    website: str | None
    phone_number: str | None
    business_status: str | None
    maps_url: str | None
    business_type: str | None = None
    category: str | None = None
    area: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    rating: float | None = None
    reviews_count: int | None = None
    business_description: str | None = None


@dataclass(slots=True)
class WebsiteCheckResult:
    status: str
    issue: str
    final_url: str | None = None
    http_status: int | None = None
    emails: list[str] = field(default_factory=list)


@dataclass(slots=True)
class Lead:
    name: str
    address: str
    phone_number: str | None
    website: str | None
    email_addresses: list[str]
    maps_url: str | None
    business_status: str | None
    website_status: str
    website_issue: str
    checked_url: str | None
    http_status: int | None
    business_type: str | None = None
    category: str | None = None
    area: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    rating: float | None = None
    reviews_count: int | None = None
    business_description: str | None = None

    @property
    def is_flagged(self) -> bool:
        return self.website_status != "Working"

    @property
    def lead_reason(self) -> str:
        if not self.website:
            return "No website listed"
        return self.website_issue

    @property
    def email_display(self) -> str:
        return ", ".join(self.email_addresses) if self.email_addresses else "Not found"

    @property
    def phone_display(self) -> str:
        return self.phone_number or "Not found"

    @property
    def website_display(self) -> str:
        return self.website or "Not listed"

    @property
    def business_type_display(self) -> str:
        return self.business_type or "Not specified"

    @property
    def category_display(self) -> str:
        return self.category or self.business_type_display

    def to_csv_row(self) -> dict[str, str]:
        row = asdict(self)
        row["business_type"] = self.business_type_display
        row["email_addresses"] = self.email_display
        row["phone_number"] = self.phone_display
        row["website"] = self.website_display
        row["lead_reason"] = self.lead_reason
        return row
