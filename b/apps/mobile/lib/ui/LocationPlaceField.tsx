import { useCallback, useEffect, useId, useRef, useState, type Ref } from "react";
import {
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ReturnKeyTypeOptions,
} from "react-native";
import { HelperText, Icon, Text } from "react-native-paper";
import {
  ApiError,
  postLocationAutocomplete,
  postLocationDetails,
  type LocationSuggestion,
} from "@/lib/api/client";
import {
  selectionIsDuplicate,
  type WorkLocationSelection,
} from "@/lib/broker/workLocationSelections";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { chipWidthForRow } from "@/lib/ui/chipWidthForRow";
import type { FieldFocusHandle } from "@/lib/ui/fieldFocusChain";
import { TextField } from "@/lib/ui/TextField";

const DEBOUNCE_MS = 400;
const CHIP_MIN = 44;
const CHIP_GAP = 8;

type Props = {
  selections: WorkLocationSelection[];
  onChange: (next: WorkLocationSelection[]) => void;
  isDisabled?: boolean;
  error?: string;
  /** Force free-text mode (e.g. Places key missing). */
  forceManual?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  searchFieldRef?: Ref<FieldFocusHandle>;
};

function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== "object") {
    return null;
  }
  const code = (err.body as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Google Places Autocomplete (via TrustKeyper proxy) with multi-select chips.
 * Falls back to free-text region entry when Places is unavailable.
 */
export function LocationPlaceField({
  selections,
  onChange,
  isDisabled = false,
  error,
  forceManual = false,
  returnKeyType,
  onSubmitEditing,
  searchFieldRef,
}: Props) {
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const listLabelId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(forceManual);
  const [selectingPlaceId, setSelectingPlaceId] = useState<string | null>(null);
  const [manualRegion, setManualRegion] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [chipRowWidth, setChipRowWidth] = useState(0);

  const sessionTokenRef = useRef(newSessionToken());
  const latestQueryRef = useRef("");

  useEffect(() => {
    if (forceManual) setManualMode(true);
  }, [forceManual]);

  const runSearch = useCallback(async () => {
    const input = latestQueryRef.current.trim();
    if (input.length < 2 || manualMode) {
      setSuggestions([]);
      setEmptyMessage(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setEmptyMessage(null);
    try {
      const result = await postLocationAutocomplete({
        input,
        sessionToken: sessionTokenRef.current,
      });
      if (latestQueryRef.current.trim() !== input) return;
      setSuggestions(result.suggestions);
      setEmptyMessage(
        result.suggestions.length === 0
          ? "No places found. Try a different search or enter manually."
          : null,
      );
    } catch (err) {
      if (latestQueryRef.current.trim() !== input) return;
      const code = apiErrorCode(err);
      if (
        code === "PLACES_UNAVAILABLE" ||
        (err instanceof ApiError && (err.status === 503 || err.status === 502))
      ) {
        setManualMode(true);
        setSearchError(
          "Location search is temporarily unavailable. Enter your area manually.",
        );
        setSuggestions([]);
        return;
      }
      setSearchError(
        err instanceof Error
          ? err.message
          : "Could not search locations. Try again or enter manually.",
      );
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, [manualMode]);

  const { schedule, cancel } = useDebouncedCallback(() => {
    void runSearch();
  }, DEBOUNCE_MS);

  function resetSession(): void {
    sessionTokenRef.current = newSessionToken();
  }

  function handleQueryChange(text: string): void {
    setQuery(text);
    latestQueryRef.current = text;
    setSearchError(null);
    if (manualMode) return;
    if (text.trim().length < 2) {
      cancel();
      setSuggestions([]);
      setEmptyMessage(null);
      return;
    }
    schedule();
  }

  async function selectSuggestion(suggestion: LocationSuggestion): Promise<void> {
    if (isDisabled || selectingPlaceId) return;
    setSelectingPlaceId(suggestion.placeId);
    setSearchError(null);
    try {
      const details = await postLocationDetails({
        placeId: suggestion.placeId,
        sessionToken: sessionTokenRef.current,
      });
      resetSession();

      const next: WorkLocationSelection = {
        key: details.placeId,
        // Prefer autocomplete main text (what the broker tapped) so chips and
        // saved region stay specific even if details locality is city-level.
        label:
          details.pincode != null
            ? `${suggestion.primaryText || details.region} · ${details.pincode}`
            : suggestion.primaryText ||
              details.formattedAddress ||
              details.region,
        region: suggestion.primaryText.trim() || details.region,
        pincode: details.pincode,
      };

      if (selectionIsDuplicate(selections, next)) {
        setSearchError("That place is already added.");
        setQuery("");
        setSuggestions([]);
        return;
      }

      onChange([...selections, next]);
      setQuery("");
      setSuggestions([]);
      setEmptyMessage(null);
    } catch (err) {
      resetSession();
      const code = apiErrorCode(err);
      if (code === "PLACES_UNAVAILABLE" || (err instanceof ApiError && err.status === 503)) {
        setManualMode(true);
        setSearchError(
          "Location search is temporarily unavailable. Enter your area manually.",
        );
      } else {
        setSearchError(
          err instanceof Error
            ? err.message
            : "Could not load that place. Try another result or enter manually.",
        );
      }
    } finally {
      setSelectingPlaceId(null);
    }
  }

  function removeSelection(key: string): void {
    onChange(selections.filter((item) => item.key !== key));
  }

  function addManualSelection(): void {
    setManualError(null);
    const region = manualRegion.trim();
    if (region.length === 0) {
      setManualError("Enter an area or city name.");
      return;
    }
    const next: WorkLocationSelection = {
      key: `manual:${region.toLowerCase()}`,
      label: region,
      region,
      pincode: null,
    };
    if (selectionIsDuplicate(selections, next)) {
      setManualError("That place is already added.");
      return;
    }
    onChange([...selections, next]);
    setManualRegion("");
  }

  function onChipRowLayout(event: LayoutChangeEvent): void {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== chipRowWidth) {
      setChipRowWidth(nextWidth);
    }
  }

  const measuredChipWidth = chipWidthForRow(chipRowWidth);
  const fallbackChipWidth = chipWidthForRow(Math.max(0, windowWidth - 48));
  const chipWidth = measuredChipWidth > 0 ? measuredChipWidth : fallbackChipWidth;

  return (
    <View style={{ width: "100%", gap: 12 }}>
      {!manualMode ? (
        <>
          <TextField
            ref={searchFieldRef}
            label="Search locations"
            necessityIndicator="required"
            value={query}
            onChangeText={handleQueryChange}
            isDisabled={isDisabled || selectingPlaceId !== null}
            autoCapitalize="words"
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={false}
            error={emptyMessage ?? undefined}
          />
          {isSearching || selectingPlaceId ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontFamily: fontFamilies.robotoRegular,
                }}
              >
                {selectingPlaceId ? "Adding place…" : "Searching…"}
              </Text>
            </View>
          ) : null}
          {suggestions.length > 0 ? (
            <View
              accessibilityLabelledBy={listLabelId}
              style={{
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
                borderRadius: shape.radiusInput,
                backgroundColor: theme.colors.primaryContainer,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Icon
                  source="lightbulb-outline"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text
                  nativeID={listLabelId}
                  variant="labelMedium"
                  style={{
                    color: theme.colors.onPrimaryContainer,
                    fontFamily: fontFamilies.robotoMedium,
                  }}
                >
                  Suggestions
                </Text>
              </View>
              {suggestions.map((item, index) => (
                <Pressable
                  key={item.placeId}
                  onPress={() => void selectSuggestion(item)}
                  disabled={isDisabled || selectingPlaceId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.primaryText}. ${item.secondaryText}`}
                  style={({ pressed }) => ({
                    minHeight: CHIP_MIN,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.primary,
                    backgroundColor: pressed
                      ? theme.colors.primaryContainer
                      : theme.colors.surface,
                  })}
                >
                  <Text
                    variant="bodyLarge"
                    style={{
                      color: theme.colors.headingText,
                      fontFamily: fontFamilies.robotoRegular,
                    }}
                  >
                    {item.primaryText}
                  </Text>
                  {item.secondaryText ? (
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        fontFamily: fontFamilies.robotoRegular,
                        marginTop: 2,
                      }}
                    >
                      {item.secondaryText}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={() => {
              cancel();
              setManualMode(true);
              setSuggestions([]);
              setEmptyMessage(null);
            }}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel="Enter location manually"
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.primary,
                fontFamily: fontFamilies.robotoMedium,
              }}
            >
              Enter manually instead
            </Text>
          </Pressable>
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <TextField
            ref={searchFieldRef}
            label="Area or city"
            necessityIndicator="required"
            value={manualRegion}
            onChangeText={setManualRegion}
            isDisabled={isDisabled}
            autoCapitalize="words"
            placeholder="e.g. Mumbai"
            returnKeyType={returnKeyType}
            onSubmitEditing={() => {
              addManualSelection();
              onSubmitEditing?.();
            }}
          />
          <Button
            title="Add location"
            onPress={addManualSelection}
            isDisabled={isDisabled}
          />
          {!forceManual ? (
            <Pressable
              onPress={() => {
                setManualMode(false);
                setManualError(null);
                setSearchError(null);
              }}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel="Search with autocomplete"
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.primary,
                  fontFamily: fontFamilies.robotoMedium,
                }}
              >
                Search with autocomplete
              </Text>
            </Pressable>
          ) : null}
          {manualError ? <Alert description={manualError} /> : null}
        </View>
      )}

      {searchError ? <Alert description={searchError} /> : null}

      {selections.length > 0 ? (
        <View style={{ gap: 10, width: "100%" }}>
          <Text
            variant="labelMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            Selected areas
          </Text>
          <View
            onLayout={onChipRowLayout}
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: CHIP_GAP,
              width: "100%",
            }}
            accessibilityLabel={`Selected locations: ${selections.map((s) => s.label).join(", ")}`}
          >
            {selections.map((item) => (
              <View
                key={item.key}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  width: chipWidth > 0 ? chipWidth : "47%",
                  minHeight: CHIP_MIN,
                  paddingLeft: 12,
                  paddingRight: 4,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.surface,
                  overflow: "hidden",
                }}
              >
                <Text
                  variant="bodyMedium"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: theme.colors.headingText,
                    fontFamily: fontFamilies.robotoRegular,
                  }}
                >
                  {item.label}
                </Text>
                <Pressable
                  onPress={() => removeSelection(item.key)}
                  disabled={isDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.label}`}
                  hitSlop={4}
                  style={{
                    width: CHIP_MIN,
                    minWidth: CHIP_MIN,
                    minHeight: CHIP_MIN,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: shape.radiusChip,
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    source="delete-outline"
                    size={18}
                    color={theme.colors.primary}
                  />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {error ? (
        <HelperText type="error" visible accessibilityLiveRegion="polite">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}
