/**
 * Dev-only visual QA for create-agreement redesign.
 * Open: /create-agreement-preview?step=property|owners|tenants|inventory|terms
 */
import { useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import {
  durationPartsFromRange,
  endDatePickerMinDate,
  formatDurationDisplay,
  isExecutionAfterStart,
  startOfLocalToday,
} from "@/lib/agreements/dateHelpers";
import { InventoryItemEditorSheet } from "@/lib/agreements/InventoryItemEditorSheet";
import { partyCardLabel } from "@/lib/agreements/partyCardHelpers";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { CheckboxOption } from "@/lib/ui/CheckboxOption";
import { CreateAgreementStepLayout } from "@/lib/ui/CreateAgreementStepLayout";
import { DateField } from "@/lib/ui/DateField";
import { FilterChipGroup } from "@/lib/ui/FilterChipGroup";
import { MoneyField } from "@/lib/ui/MoneyField";
import { RentDueDateField } from "@/lib/ui/RentDueDateField";
import { SelectField } from "@/lib/ui/SelectField";
import { TextAreaField } from "@/lib/ui/TextAreaField";
import { TextField } from "@/lib/ui/TextField";

const FIXTURE_ADDRESS = "Flat 402, Sunset Heights, Whitefield";
const noop = (): void => undefined;

function PropertyPreview() {
  return (
    <CreateAgreementStepLayout
      step={1}
      title="Property Details"
      onBack={noop}
      onNext={noop}
      onCancel={noop}
    >
      <View style={{ width: "100%", gap: shape.fieldStackGap }}>
        <TextAreaField
          label="Property Address"
          value={FIXTURE_ADDRESS}
          onChangeText={noop}
        />
        <TextField
          label="Area (sq ft)"
          value="1450"
          onChangeText={noop}
        />
        <SelectField
          label="Facing"
          value="East"
          options={[
            "North",
            "South",
            "East",
            "West",
            "North-East",
            "North-West",
            "South-East",
            "South-West",
          ]}
          onChange={noop}
          placeholder="Select direction"
        />
        <TextField
          label="Car parking"
          value="2"
          onChangeText={noop}
        />
      </View>
    </CreateAgreementStepLayout>
  );
}

function OwnersPreview() {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(true);

  return (
    <CreateAgreementStepLayout
      step={2}
      title="Owner details"
      nextTitle="Next step"
      onBack={noop}
      onNext={noop}
      onCancel={noop}
    >
      <View style={{ width: "100%", gap: shape.fieldStackGap }}>
        <View
          style={{
            width: "100%",
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: shape.radiusCard,
            padding: 16,
            gap: shape.fieldStackGap,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collapse Rajesh Kumar"
            onPress={() => setExpanded((value) => !value)}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 4,
              gap: 8,
            }}
          >
            <Text
              variant="titleMedium"
              style={{
                color: theme.colors.headingText,
                fontFamily: fontFamilies.robotoMedium,
              }}
            >
              {partyCardLabel("owner", 1, "Rajesh Kumar")}
            </Text>
          </Pressable>
          {expanded ? (
            <View style={{ width: "100%", gap: shape.fieldStackGap }}>
              <FilterChipGroup
                label="Title"
                value="Mr."
                options={[
                  { value: "Mr.", label: "Mr." },
                  { value: "Ms.", label: "Ms." },
                  { value: "Mrs.", label: "Mrs." },
                ]}
                onChange={noop}
              />
              <TextField
                label="Name"
                value="Rajesh Kumar"
                onChangeText={noop}
              />
              <TextField label="Age" value="52" onChangeText={noop} />
              <TextAreaField
                label="Current address (as per Aadhaar Card)"
                value="12, MG Road, Bangalore"
                onChangeText={noop}
              />
              <TextField
                label="Aadhaar Number"
                value="967132807649"
                onChangeText={noop}
                maxCharacters={12}
                keyboardType="number"
              />
              <TextField
                label="PAN"
                value="ABCDE1234F"
                onChangeText={noop}
                necessityIndicator="optional"
              />
              <TextField
                label="Email Address"
                value="rajesh@example.com"
                onChangeText={noop}
              />
              <TextField
                label="Phone Number"
                value="9876543210"
                onChangeText={noop}
              />
            </View>
          ) : null}
        </View>
        <Button
          title="Add another owner"
          onPress={noop}
          variant="secondary"
          textColor={theme.colors.primary}
          outlineColor={theme.colors.primary}
          icon="account-plus"
          isDisabled
        />
      </View>
    </CreateAgreementStepLayout>
  );
}

function TenantsPreview() {
  const theme = useAppTheme();

  return (
    <CreateAgreementStepLayout
      step={3}
      title="Tenant details"
      nextTitle="Next step"
      onBack={noop}
      onNext={noop}
      onCancel={noop}
    >
      <View style={{ width: "100%", gap: shape.fieldStackGap }}>
        <View
          style={{
            width: "100%",
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: shape.radiusCard,
            padding: 16,
            gap: shape.fieldStackGap,
          }}
        >
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.headingText,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            {partyCardLabel("tenant", 1, "")}
          </Text>
        </View>
        <Button
          title="Add another tenant"
          onPress={noop}
          variant="secondary"
          textColor={theme.colors.primary}
          outlineColor={theme.colors.primary}
          icon="account-plus"
        />
      </View>
    </CreateAgreementStepLayout>
  );
}

function InventoryPreview() {
  const theme = useAppTheme();
  const [editor, setEditor] = useState<
    | { mode: "closed" }
    | { mode: "add" }
    | { mode: "edit"; description: string; quantity: number }
  >({ mode: "closed" });
  const items = [
    { description: "Daikin split air conditioners in good working condition", quantity: 4 },
    { description: "Samsung double-door refrigerator", quantity: 1 },
    { description: "Modular kitchen with chimney and hob", quantity: 1 },
  ];

  return (
    <CreateAgreementStepLayout
      step={4}
      title="Fixtures & Fittings"
      onBack={noop}
      onNext={noop}
      onCancel={noop}
    >
      <Text
        variant="bodyMedium"
        style={{
          color: theme.colors.onSurfaceVariant,
          fontFamily: fontFamilies.robotoRegular,
        }}
      >
        List the fixtures, fittings and furniture included with the property
      </Text>
      {items.map((item, index) => {
        const label = `Item ${index + 1}`;
        const summary = `${item.description} × ${item.quantity}`;
        return (
          <View
            key={item.description}
            style={{
              width: "100%",
              backgroundColor: theme.colors.surfaceVariant,
              borderRadius: shape.radiusCard,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                minHeight: 56,
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: 16,
                paddingRight: 16,
                gap: 8,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  variant="labelSmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    fontFamily: fontFamilies.robotoMedium,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </Text>
                <Text
                  variant="bodyMedium"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={{
                    color: theme.colors.onSurface,
                    fontFamily: fontFamilies.robotoRegular,
                  }}
                >
                  {summary}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${label}`}
                onPress={() =>
                  setEditor({
                    mode: "edit",
                    description: item.description,
                    quantity: item.quantity,
                  })
                }
              >
                <Text style={{ color: theme.colors.primary }}>✎</Text>
              </Pressable>
              <Text style={{ color: theme.colors.error }}>✕</Text>
            </View>
          </View>
        );
      })}
      <Button
        title="Add item"
        onPress={() => setEditor({ mode: "add" })}
        variant="secondary"
        textColor={theme.colors.primary}
        outlineColor={theme.colors.primary}
        icon="plus"
      />
      <InventoryItemEditorSheet
        visible={editor.mode !== "closed"}
        title={editor.mode === "edit" ? "Edit item" : "Add item"}
        initialDescription={
          editor.mode === "edit" ? editor.description : ""
        }
        initialQuantity={editor.mode === "edit" ? editor.quantity : 1}
        onClose={() => setEditor({ mode: "closed" })}
        onSave={() => setEditor({ mode: "closed" })}
      />
    </CreateAgreementStepLayout>
  );
}

function TermsPreview() {
  const theme = useAppTheme();
  const [executionDate, setExecutionDate] = useState("2026-11-24");
  const [startDate, setStartDate] = useState("2025-08-15");
  const [endDate, setEndDate] = useState("2026-08-14");
  const [lockIn, setLockIn] = useState("6");
  const [rent, setRent] = useState("45000");
  const [deposit, setDeposit] = useState("135000");
  const [maintenanceIncluded, setMaintenanceIncluded] = useState(false);
  const [maintenance, setMaintenance] = useState("3000");
  const [rentDueDay, setRentDueDay] = useState("5");
  const todayMin = startOfLocalToday();
  const endMin = endDatePickerMinDate(startDate);
  const durationParts = durationPartsFromRange(startDate, endDate);
  const durationPlainText =
    durationParts === null ? null : formatDurationDisplay(durationParts);

  function section(label: string, children: ReactNode) {
    return (
      <View
        style={{
          width: "100%",
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: shape.radiusCard,
          padding: 12,
          gap: shape.sectionFieldGap,
        }}
      >
        <Text
          variant="labelMedium"
          style={{
            color: theme.colors.primary,
            fontFamily: fontFamilies.robotoMedium,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        {children}
      </View>
    );
  }

  return (
    <CreateAgreementStepLayout
      step={5}
      title="Agreement details"
      nextTitle="Finish"
      onBack={noop}
      onNext={noop}
      onCancel={noop}
    >
      <View style={{ width: "100%", gap: shape.sectionStackGap }}>
      {section(
        "Dates",
        <>
          <DateField
            label="Agreement execution date"
            value={executionDate}
            onChange={setExecutionDate}
            minDate={todayMin}
          />
          <DateField
            label="Start date"
            value={startDate}
            onChange={setStartDate}
            minDate={todayMin}
          />
          <DateField
            label="End date"
            value={endDate}
            onChange={setEndDate}
            minDate={endMin}
          />
          {isExecutionAfterStart(executionDate, startDate) ? (
            <Alert
              color="notice"
              description="Agreement execution date is after the start date. Unusual, but you can still continue."
            />
          ) : null}
          {durationPlainText ? (
            <Text
              variant="bodyLarge"
              style={{
                color: theme.colors.onSurface,
                fontFamily: fontFamilies.robotoRegular,
              }}
            >
              {durationPlainText}
            </Text>
          ) : null}
          <TextField
            label="City"
            value="BENGALURU"
            onChangeText={() => undefined}
          />
        </>,
      )}
      {section(
        "Lock-in & notice",
        <>
          <TextField
            label="Lock-in period"
            value={lockIn}
            onChangeText={setLockIn}
            keyboardType="number"
            suffix="months"
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Notice (tenant)"
                value="2"
                onChangeText={() => undefined}
                keyboardType="number"
                suffix="months"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Notice (owner)"
                value="3"
                onChangeText={() => undefined}
                keyboardType="number"
                suffix="months"
              />
            </View>
          </View>
        </>,
      )}
      {section(
        "Rent details",
        <>
          <MoneyField label="Monthly rent" value={rent} onChangeText={setRent} />
          <MoneyField
            label="Security deposit"
            value={deposit}
            onChangeText={setDeposit}
          />
          <CheckboxOption
            label="Maintenance included in rent"
            isChecked={maintenanceIncluded}
            onChange={setMaintenanceIncluded}
          />
          <MoneyField
            label="Monthly maintenance"
            value={maintenance}
            onChangeText={setMaintenance}
            isDisabled={maintenanceIncluded}
          />
          <RentDueDateField
            value={rentDueDay}
            onChangeText={setRentDueDay}
          />
        </>,
      )}
      </View>
    </CreateAgreementStepLayout>
  );
}

export default function CreateAgreementPreviewScreen() {
  const params = useLocalSearchParams<{ step?: string }>();
  if (params.step === "owners" || params.step === "parties") return <OwnersPreview />;
  if (params.step === "tenants") return <TenantsPreview />;
  if (params.step === "inventory") return <InventoryPreview />;
  if (params.step === "terms") return <TermsPreview />;
  return <PropertyPreview />;
}
