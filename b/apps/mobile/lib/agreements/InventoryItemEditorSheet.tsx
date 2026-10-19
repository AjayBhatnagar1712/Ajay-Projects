import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import {
  inventoryDescriptionError,
  inventoryQuantityError,
} from "./inventoryItemEditor";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { BottomSheet } from "@/lib/ui/BottomSheet";
import { Button } from "@/lib/ui/Button";
import { QuantityStepper } from "@/lib/ui/QuantityStepper";
import { MIN_STEPPER_VALUE } from "@/lib/ui/stepQuantity";
import { TEXT_AREA_COMPACT_LINES } from "@/lib/ui/textAreaFieldChrome";
import { TextAreaField } from "@/lib/ui/TextAreaField";

export type InventoryItemDraft = {
  description: string;
  quantity: number;
};

type Props = {
  visible: boolean;
  title: string;
  initialDescription: string;
  initialQuantity: number;
  isDisabled?: boolean;
  onClose: () => void;
  onSave: (draft: InventoryItemDraft) => void;
};

/**
 * Add/edit fixture drawer — content-sized bottom sheet (not pageSheet).
 * Saves into the parent list; does not keep the item inside the sheet after Save.
 */
export function InventoryItemEditorSheet({
  visible,
  title,
  initialDescription,
  initialQuantity,
  isDisabled = false,
  onClose,
  onSave,
}: Props) {
  const theme = useAppTheme();
  const [description, setDescription] = useState(initialDescription);
  const [quantity, setQuantity] = useState(
    Number.isInteger(initialQuantity) && initialQuantity >= MIN_STEPPER_VALUE
      ? initialQuantity
      : MIN_STEPPER_VALUE,
  );
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [focusDescription, setFocusDescription] = useState(false);

  useEffect(() => {
    if (!visible) {
      setFocusDescription(false);
      return;
    }
    setDescription(initialDescription);
    setQuantity(
      Number.isInteger(initialQuantity) && initialQuantity >= MIN_STEPPER_VALUE
        ? initialQuantity
        : MIN_STEPPER_VALUE,
    );
    setDescriptionError(null);
    setQuantityError(null);
  }, [visible, initialDescription, initialQuantity]);

  function handleSave(): void {
    const descMessage = inventoryDescriptionError(description);
    const qtyMessage = inventoryQuantityError(quantity);
    setDescriptionError(descMessage);
    setQuantityError(qtyMessage);
    if (descMessage || qtyMessage) return;
    onSave({ description: description.trim(), quantity });
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={title}
      onEntered={() => setFocusDescription(true)}
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
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          disabled={isDisabled}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 8,
          }}
        >
          <Text style={{ color: theme.colors.primary }}>Cancel</Text>
        </Pressable>
      </View>

      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 16,
          gap: shape.sectionFieldGap,
        }}
      >
        <TextAreaField
          label="Description"
          value={description}
          onBlur={() => {
            setDescriptionError(inventoryDescriptionError(description));
          }}
          onChangeText={(text) => {
            setDescription(text);
            setDescriptionError(null);
          }}
          isDisabled={isDisabled}
          autoFocus={focusDescription}
          placeholder="e.g. Ceiling fans"
          helperText="One fixture per entry."
          error={descriptionError ?? undefined}
          numberOfLines={TEXT_AREA_COMPACT_LINES}
          returnKeyType="done"
          blurOnSubmit
        />

        <QuantityStepper
          label="Quantity"
          value={quantity}
          onChange={(next: number) => {
            setQuantity(next);
            setQuantityError(null);
          }}
          isDisabled={isDisabled}
          error={quantityError ?? undefined}
        />

        <Button
          title="Save"
          onPress={handleSave}
          isDisabled={isDisabled}
        />
      </View>
    </BottomSheet>
  );
}
