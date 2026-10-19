/**
 * Dev-only visual QA for Records body (shell chrome + fixture data).
 * Open: /records-preview  |  /records-preview?empty=1
 */
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import type { PartyContactSummary } from "@/lib/api/client";
import type { PropertyRecord } from "@/lib/agreements/flow";
import { filterParties, filterProperties } from "@/lib/records/filterRecords";
import { propertyDetailRows } from "@/lib/records/formatRecordFields";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { PartyRecordCard } from "@/lib/ui/PartyRecordCard";
import { RecordCard, RecordDetailRow } from "@/lib/ui/RecordCard";
import { RecordsSearchField } from "@/lib/ui/RecordsSearchField";
import { SegmentedControl } from "@/lib/ui/SegmentedControl";
import { ShellHeader } from "@/lib/ui/ShellHeader";
import { StateScreen } from "@/lib/ui/StateScreen";

const SEGMENTS = [
  { value: "properties", label: "Properties" },
  { value: "owners", label: "Owners" },
  { value: "tenants", label: "Tenants" },
] as const;

type Segment = (typeof SEGMENTS)[number]["value"];

const FIXTURE_PROPERTIES: PropertyRecord[] = [
  {
    key: "1",
    address: "12A, Sai Residency, Andheri West",
    areaSqft: 850,
    facing: "East",
    carParkingCount: 1,
  },
  {
    key: "2",
    address: "G-402, Prestige Ferns, Bellandur",
    areaSqft: 1250,
    facing: "North-East",
    carParkingCount: 2,
  },
  {
    key: "3",
    address: "Flat 101, Omkar Alta Monte, Malad",
    areaSqft: 980,
    facing: "West",
    carParkingCount: null,
  },
];

const FIXTURE_OWNERS: PartyContactSummary[] = [
  {
    name: "Venkat Shekhar",
    phone: "9876543210",
    email: "venkat@example.com",
    address: null,
    role: "owner",
    alternateNames: ["V. Shekhar"],
    agreementCount: 3,
    agreements: [
      {
        agreementId: "a1",
        propertyAddress: "12A, Sai Residency, Andheri West",
        status: "in_review",
      },
      {
        agreementId: "a2",
        propertyAddress: "G-402, Prestige Ferns, Bellandur",
        status: "signed",
      },
      {
        agreementId: "a3",
        propertyAddress: "Step 4 address",
        status: "draft",
      },
    ],
  },
];

const FIXTURE_TENANTS: PartyContactSummary[] = [
  {
    name: "Priya Nair",
    phone: "9123456780",
    email: null,
    address: null,
    role: "tenant",
    alternateNames: [],
    agreementCount: 1,
    agreements: [
      {
        agreementId: "a1",
        propertyAddress: "12A, Sai Residency, Andheri West",
        status: "in_review",
      },
    ],
  },
];

const EMPTY_COPY: Record<Segment, { title: string; description: string }> = {
  properties: {
    title: "No properties yet",
    description: "They'll appear here once you create an agreement.",
  },
  owners: {
    title: "No owners yet",
    description: "They'll appear here once you create an agreement.",
  },
  tenants: {
    title: "No tenants yet",
    description: "They'll appear here once you create an agreement.",
  },
};

const SEARCH_PLACEHOLDER: Record<Segment, string> = {
  properties: "Search by address",
  owners: "Search by name or phone",
  tenants: "Search by name or phone",
};

export default function RecordsPreviewScreen() {
  const params = useLocalSearchParams<{ empty?: string; q?: string; tab?: string }>();
  const showEmpty = params.empty === "1";
  const initialTab = SEGMENTS.some((s) => s.value === params.tab)
    ? (params.tab as Segment)
    : "properties";
  const [segment, setSegment] = useState<Segment>(initialTab);
  const [searchQuery, setSearchQuery] = useState(
    typeof params.q === "string" ? params.q : "",
  );

  const properties = showEmpty ? [] : FIXTURE_PROPERTIES;
  const people = useMemo(() => {
    if (showEmpty) return [];
    return segment === "owners" ? FIXTURE_OWNERS : FIXTURE_TENANTS;
  }, [segment, showEmpty]);

  const filteredProperties = useMemo(
    () => filterProperties(properties, searchQuery),
    [properties, searchQuery],
  );
  const filteredPeople = useMemo(
    () => filterParties(people, searchQuery),
    [people, searchQuery],
  );

  const catalogueEmpty =
    segment === "properties" ? properties.length === 0 : people.length === 0;
  const searchActive = searchQuery.trim().length > 0;
  const filteredEmpty =
    !catalogueEmpty &&
    searchActive &&
    (segment === "properties"
      ? filteredProperties.length === 0
      : filteredPeople.length === 0);

  function onSegmentChange(value: string): void {
    setSegment(value as Segment);
    setSearchQuery("");
  }

  return (
    <ScreenSafeArea edges={["top", "left", "right"]} tabBarClearance={false}>
      <ShellHeader alerts={[]} />
      <SegmentedControl
        value={segment}
        options={SEGMENTS}
        onChange={onSegmentChange}
      />

      {!catalogueEmpty ? (
        <RecordsSearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={SEARCH_PLACEHOLDER[segment]}
        />
      ) : null}

      {catalogueEmpty ? (
        <StateScreen
          density="inline"
          icon="inbox-outline"
          title={EMPTY_COPY[segment].title}
          description={EMPTY_COPY[segment].description}
        />
      ) : null}

      {filteredEmpty ? (
        <StateScreen
          density="inline"
          icon="magnify"
          title="No results"
          description={`No results for “${searchQuery.trim()}”`}
        />
      ) : null}

      {segment === "properties" && filteredProperties.length > 0 ? (
        <View style={{ width: "100%", gap: 12 }}>
          {filteredProperties.map((property) => {
            const rows = propertyDetailRows(property);
            return (
              <RecordCard key={property.key} title={property.address}>
                <View style={{ width: "100%", gap: 6 }}>
                  {rows.map((row) => (
                    <RecordDetailRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                    />
                  ))}
                </View>
              </RecordCard>
            );
          })}
        </View>
      ) : null}

      {segment !== "properties" && filteredPeople.length > 0 ? (
        <View style={{ width: "100%", gap: 12 }}>
          {filteredPeople.map((party) => (
            <PartyRecordCard key={party.phone} party={party} />
          ))}
        </View>
      ) : null}
    </ScreenSafeArea>
  );
}
