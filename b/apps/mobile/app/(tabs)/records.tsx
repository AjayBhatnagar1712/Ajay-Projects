import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  listLeaseAgreements,
  listPartyContacts,
} from "@/lib/api/client";
import { derivePropertyRecords, type PropertyRecord } from "@/lib/agreements/flow";
import { useDerivedAlerts } from "@/lib/notifications/useDerivedAlerts";
import { filterParties, filterProperties } from "@/lib/records/filterRecords";
import { propertyDetailRows } from "@/lib/records/formatRecordFields";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { ErrorRecoveryActions } from "@/lib/ui/ErrorRecoveryActions";
import { PartyRecordCard } from "@/lib/ui/PartyRecordCard";
import { RecordCard, RecordDetailRow } from "@/lib/ui/RecordCard";
import { RecordsSearchField } from "@/lib/ui/RecordsSearchField";
import { SegmentedControl } from "@/lib/ui/SegmentedControl";
import { ShellHeader } from "@/lib/ui/ShellHeader";
import { Spinner } from "@/lib/ui/Spinner";
import { StateScreen } from "@/lib/ui/StateScreen";
import { Text } from "@/lib/ui/Typography";
import { Stack } from "@/lib/ui/Stack";

const TAB_EDGES = ["top", "left", "right"] as const;

const SEGMENTS = [
  { value: "properties", label: "Properties" },
  { value: "owners", label: "Owners" },
  { value: "tenants", label: "Tenants" },
] as const;

type Segment = (typeof SEGMENTS)[number]["value"];

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

function PropertyRecordCard({ property }: { property: PropertyRecord }) {
  const rows = propertyDetailRows(property);

  const a11yParts = [
    property.address,
    ...rows.map((row) => `${row.label}: ${row.value}`),
  ];

  return (
    <RecordCard title={property.address} accessibilityLabel={a11yParts.join(". ")}>
      {rows.length > 0 ? (
        <View style={{ width: "100%", gap: 6 }}>
          {rows.map((row) => (
            <RecordDetailRow key={row.label} label={row.label} value={row.value} />
          ))}
        </View>
      ) : null}
    </RecordCard>
  );
}

function noResultsMessage(query: string): string {
  const trimmed = query.trim();
  return `No results for “${trimmed}”`;
}

export default function RecordsTab() {
  const [segment, setSegment] = useState<Segment>("properties");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { alerts, isLoading: alertsLoading } = useDerivedAlerts();

  const agreementsQuery = useQuery({
    queryKey: ["lease-agreements"],
    queryFn: listLeaseAgreements,
    enabled: segment === "properties",
  });

  const ownersQuery = useQuery({
    queryKey: ["party-contacts", "owner"],
    queryFn: () => listPartyContacts("owner"),
    enabled: segment === "owners",
  });

  const tenantsQuery = useQuery({
    queryKey: ["party-contacts", "tenant"],
    queryFn: () => listPartyContacts("tenant"),
    enabled: segment === "tenants",
  });

  const peopleQuery =
    segment === "owners" ? ownersQuery : segment === "tenants" ? tenantsQuery : null;

  const properties = derivePropertyRecords(
    agreementsQuery.data?.leaseAgreements ?? [],
  );
  const people = peopleQuery?.data?.parties ?? [];

  const filteredProperties = useMemo(
    () => filterProperties(properties, searchQuery),
    [properties, searchQuery],
  );
  const filteredPeople = useMemo(
    () => filterParties(people, searchQuery),
    [people, searchQuery],
  );

  const activeQuery =
    segment === "properties" ? agreementsQuery : peopleQuery ?? agreementsQuery;

  const isLoading = activeQuery.isLoading;
  const error = activeQuery.error;
  const catalogueEmpty =
    !isLoading &&
    !error &&
    (segment === "properties" ? properties.length === 0 : people.length === 0);
  const searchActive = searchQuery.trim().length > 0;
  const filteredEmpty =
    !isLoading &&
    !error &&
    !catalogueEmpty &&
    searchActive &&
    (segment === "properties"
      ? filteredProperties.length === 0
      : filteredPeople.length === 0);

  function onSegmentChange(value: string): void {
    setSegment(value as Segment);
    // Reset search on segment switch — less surprising than carrying a
    // Properties address query into Owners/Tenants (or vice versa).
    setSearchQuery("");
  }

  async function onRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      await Promise.all([
        agreementsQuery.refetch(),
        ownersQuery.refetch(),
        tenantsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  const showSearch = !isLoading && !error && !catalogueEmpty;
  const showPropertyList =
    !isLoading &&
    !error &&
    segment === "properties" &&
    filteredProperties.length > 0;
  const showPeopleList =
    !isLoading &&
    !error &&
    segment !== "properties" &&
    filteredPeople.length > 0;

  return (
    <ScreenSafeArea
      edges={TAB_EDGES}
      refreshing={refreshing}
      onRefresh={() => {
        void onRefresh();
      }}
    >
      <ShellHeader alerts={alerts} alertsLoading={alertsLoading} />

      <SegmentedControl
        value={segment}
        options={SEGMENTS}
        onChange={onSegmentChange}
        accessibilityLabel="Record type"
      />

      {showSearch ? (
        <RecordsSearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={SEARCH_PLACEHOLDER[segment]}
          accessibilityLabel={`Search ${segment}`}
        />
      ) : null}

      {isLoading ? (
        <Stack gap="spacing.3">
          <Spinner
            accessibilityLabel={
              segment === "properties"
                ? "Loading properties"
                : `Loading ${segment}`
            }
          />
          <Text color="subtle">
            {segment === "properties"
              ? "Loading properties…"
              : `Loading ${segment}…`}
          </Text>
        </Stack>
      ) : null}

      {error ? (
        <ErrorRecoveryActions onRetry={() => void activeQuery.refetch()} />
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
          description={noResultsMessage(searchQuery)}
        />
      ) : null}

      {showPropertyList ? (
        <View style={{ width: "100%", gap: 12 }}>
          {filteredProperties.map((property) => (
            <PropertyRecordCard key={property.key} property={property} />
          ))}
        </View>
      ) : null}

      {showPeopleList ? (
        <View style={{ width: "100%", gap: 12 }}>
          {filteredPeople.map((party) => (
            <PartyRecordCard key={`${party.role}:${party.phone}`} party={party} />
          ))}
        </View>
      ) : null}
    </ScreenSafeArea>
  );
}
