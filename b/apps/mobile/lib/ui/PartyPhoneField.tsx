import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  View,
  type ListRenderItem,
  type ReturnKeyTypeOptions,
} from "react-native";
import { HelperText, TextInput, Text } from "react-native-paper";
import type { CountryCode } from "libphonenumber-js";
import {
  composePartyPhone,
  listPartyPhoneCountries,
  nationalPhoneDigitLength,
  normalizeNationalPhoneInput,
  normalizePartyPhoneE164,
  partyPhoneBlurError,
  partyPhoneChangeError,
  splitPartyPhone,
  type PartyPhoneCountryOption,
} from "@workspace/api-schemas";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import type { FieldFocusHandle } from "@/lib/ui/fieldFocusChain";
import {
  FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS,
  formScrollKeyboardDismissMode,
} from "@/lib/ui/formScrollKeyboard";
import {
  outlinedFieldContentStyle,
  outlinedFieldStyle,
} from "@/lib/ui/outlinedFieldChrome";

type Props = {
  label?: string;
  value: string;
  onChange: (e164OrProvisional: string) => void;
  onBlur?: () => void;
  error?: string;
  isDisabled?: boolean;
  /** Called when blur validation produces a message (or clears). */
  onValidationMessage?: (message: string | null) => void;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
};

/**
 * Party phone field: searchable country dial-code sheet + national digits.
 * Stores E.164 when valid; provisional `+{cc}{digits}` while incomplete.
 * Uses a bottom sheet (Modal pageSheet) rather than SelectField's Menu — the
 * full country list is too long for a dropdown.
 *
 * National digits use `numeric` (not phone-pad) so returnKeyType Next/Done is
 * available on iOS when keyboard chaining is enabled.
 */
export const PartyPhoneField = forwardRef<FieldFocusHandle, Props>(
  function PartyPhoneField(
    {
      label = "Phone Number",
      value,
      onChange,
      onBlur,
      error,
      isDisabled = false,
      onValidationMessage,
      returnKeyType,
      onSubmitEditing,
      blurOnSubmit,
    },
    ref,
  ) {
  const theme = useAppTheme();
  const initial = splitPartyPhone(value);
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const nationalRef = useRef<FieldFocusHandle | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      nationalRef.current?.focus();
    },
    measureInWindow: (callback) => {
      nationalRef.current?.measureInWindow?.(callback);
    },
  }));

  const localRef = useRef({ country, national });
  localRef.current = { country, national };

  useEffect(() => {
    const { country: currentCountry, national: currentNational } =
      localRef.current;
    if (value === composePartyPhone(currentCountry, currentNational)) return;
    // External load/reset (valid E.164 or cleared) — resync UI from storage.
    if (normalizePartyPhoneE164(value) || value.trim().length === 0) {
      const next = splitPartyPhone(value, currentCountry);
      setCountry(next.country);
      setNational(next.national);
    }
  }, [value]);

  const countries = useMemo(() => listPartyPhoneCountries(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return countries;
    return countries.filter(
      (option) =>
        option.name.toLowerCase().includes(q) ||
        option.country.toLowerCase().includes(q) ||
        option.dialCode.includes(q) ||
        option.dialCode.replace("+", "").includes(q),
    );
  }, [countries, query]);

  const selected = countries.find((option) => option.country === country);
  const dialLabel = selected
    ? `${selected.flag} ${selected.dialCode}`
    : "+91";

  function commit(nextCountry: CountryCode, nextNational: string): void {
    setCountry(nextCountry);
    setNational(nextNational);
    onChange(composePartyPhone(nextCountry, nextNational));
  }

  function handleBlur(): void {
    onBlur?.();
    const message = partyPhoneBlurError(national, country);
    onValidationMessage?.(message);
  }

  const renderItem: ListRenderItem<PartyPhoneCountryOption> = ({ item }) => {
    const selectedRow = item.country === country;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: selectedRow }}
        onPress={() => {
          commit(item.country, national);
          setPickerOpen(false);
          setQuery("");
          onValidationMessage?.(null);
        }}
        style={{
          minHeight: 48,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: selectedRow
            ? theme.colors.surfaceVariant
            : theme.colors.surface,
        }}
      >
        <Text style={{ fontSize: 22 }}>{item.flag}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            variant="bodyLarge"
            style={{
              color: theme.colors.onSurface,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            {item.name}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {item.country} · {item.dialCode}
          </Text>
        </View>
        {selectedRow ? (
          <Text style={{ color: theme.colors.primary }}>✓</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={{ width: "100%" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Country code ${dialLabel}`}
          accessibilityState={{ disabled: isDisabled, expanded: pickerOpen }}
          disabled={isDisabled}
          onPress={() => setPickerOpen(true)}
          style={{ width: 112 }}
        >
          <View pointerEvents="none">
            <TextInput
              mode="outlined"
              label="Code"
              value={dialLabel}
              editable={false}
              disabled={isDisabled}
              error={Boolean(error)}
              right={<TextInput.Icon icon="menu-down" />}
              style={outlinedFieldStyle(theme)}
              contentStyle={outlinedFieldContentStyle}
            />
          </View>
        </Pressable>

        <View style={{ flex: 1 }}>
          <TextInput
            ref={(node: FieldFocusHandle | null) => {
              nationalRef.current = node;
            }}
            mode="outlined"
            label={label}
            value={national}
            onChangeText={(text) => {
              const digits = normalizeNationalPhoneInput(
                text,
                nationalPhoneDigitLength(country),
              );
              commit(country, digits);
              onValidationMessage?.(partyPhoneChangeError(digits, country));
            }}
            onBlur={handleBlur}
            disabled={isDisabled}
            error={Boolean(error)}
            keyboardType="numeric"
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={blurOnSubmit}
            maxLength={nationalPhoneDigitLength(country)}
            accessibilityLabel={label}
            style={outlinedFieldStyle(theme)}
            contentStyle={outlinedFieldContentStyle}
          />
        </View>
      </View>
      {error ? (
        <HelperText type="error" visible accessibilityLiveRegion="polite">
          {error}
        </HelperText>
      ) : null}

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setPickerOpen(false);
          setQuery("");
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            paddingTop: 12,
          }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              variant="titleMedium"
              style={{
                color: theme.colors.headingText,
                fontFamily: fontFamilies.robotoMedium,
              }}
            >
              Country code
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close country list"
              onPress={() => {
                setPickerOpen(false);
                setQuery("");
              }}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
            >
              <Text style={{ color: theme.colors.primary }}>Done</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TextInput
              mode="outlined"
              label="Search"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              style={outlinedFieldStyle(theme)}
              contentStyle={outlinedFieldContentStyle}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.country}
            renderItem={renderItem}
            keyboardShouldPersistTaps={FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS}
            keyboardDismissMode={formScrollKeyboardDismissMode(Platform.OS)}
            initialNumToRender={20}
            windowSize={10}
          />
        </View>
      </Modal>
    </View>
  );
  },
);
