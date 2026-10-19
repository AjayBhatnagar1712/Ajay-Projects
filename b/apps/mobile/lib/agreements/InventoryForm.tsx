import { zodResolver } from "@hookform/resolvers/zod";
import {
  LeaseInventoryReplaceSchema,
  type LeaseInventoryReplace,
} from "@workspace/api-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Alert as NativeAlert, View } from "react-native";
import { Text } from "react-native-paper";
import {
  replaceLeaseAgreementInventory,
  type LeaseAgreementDetail,
} from "../api/client";
import {
  type CreateAgreementEditOrigin,
  type CreateAgreementEntry,
  goToPreviousCreateStep,
  replaceCreateAgreementStep,
} from "./createAgreementNav";
import {
  InventoryItemEditorSheet,
  type InventoryItemDraft,
} from "./InventoryItemEditorSheet";
import {
  buildInventoryAutosavePayload,
  serializeAutosavePayload,
} from "./stepAutosavePayloads";
import { useAgreementStepAutosave } from "./useAgreementStepAutosave";
import { useCreateAgreementHardwareBack } from "./useCreateAgreementHardwareBack";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { AppIconButton } from "@/lib/ui/AppIconButton";
import { Button } from "@/lib/ui/Button";
import { CreateAgreementStepLayout } from "@/lib/ui/CreateAgreementStepLayout";

type InventoryFormProps = {
  agreementId: string;
  detail: LeaseAgreementDetail;
  entry: CreateAgreementEntry;
  editOrigin?: CreateAgreementEditOrigin;
};

type EditorState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; index: number };

/**
 * Fixtures & fittings — list on the step screen; add/edit in a bottom
 * sheet. Autosave still watches `items` via useAgreementStepAutosave.
 */
export function InventoryForm({
  agreementId,
  detail,
  entry,
  editOrigin,
}: InventoryFormProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });

  const defaultItems = [...detail.inventory]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      description: item.description,
      quantity: item.quantity ?? 1,
      sortOrder: item.sortOrder,
    }));

  const {
    control,
    handleSubmit,
    getValues,
    watch,
  } = useForm<LeaseInventoryReplace>({
    resolver: zodResolver(LeaseInventoryReplaceSchema),
    defaultValues: {
      items: defaultItems,
    },
  });
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "items",
  });
  const items = watch("items");

  const [initialSerialized] = useState(() => {
    const payload = buildInventoryAutosavePayload(defaultItems);
    return payload ? serializeAutosavePayload(payload) : null;
  });

  const buildPayload = useCallback(
    () => buildInventoryAutosavePayload(getValues("items")),
    [getValues],
  );

  const saveInventoryAutosave = useCallback(
    async (
      payload: NonNullable<ReturnType<typeof buildInventoryAutosavePayload>>,
    ) => {
      await replaceLeaseAgreementInventory(agreementId, payload);
      await queryClient.invalidateQueries({
        queryKey: ["lease-agreement", agreementId],
      });
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
    },
    [agreementId, queryClient],
  );

  const {
    status: autosaveStatus,
    flush: flushAutosave,
    cancel: cancelAutosave,
    markSaved,
  } = useAgreementStepAutosave({
    watched: items,
    buildPayload,
    save: saveInventoryAutosave,
    initialSerialized,
    previewEditAgreementId: editOrigin ? agreementId : undefined,
    previewEditStepKey: "inventory",
  });

  const canAddItem = !isSubmitting && fields.length < 200;

  const onNext = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await flushAutosave();
      const payload = {
        items: values.items.map((item, index) => ({
          description: item.description,
          quantity: item.quantity,
          sortOrder: index,
        })),
      };
      await replaceLeaseAgreementInventory(agreementId, payload);
      markSaved(payload);
      await queryClient.invalidateQueries({
        queryKey: ["lease-agreement", agreementId],
      });
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
      replaceCreateAgreementStep(router, 5, entry, agreementId, editOrigin);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Could not save fixtures & fittings",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const onBack = useCallback(() => {
    void (async () => {
      await flushAutosave();
      goToPreviousCreateStep(router, 4, entry, agreementId, editOrigin);
    })();
  }, [agreementId, editOrigin, entry, flushAutosave, router]);

  useCreateAgreementHardwareBack(onBack);

  function openAdd(): void {
    if (!canAddItem) return;
    setEditor({ mode: "add" });
  }

  function openEdit(index: number): void {
    setEditor({ mode: "edit", index });
  }

  function closeEditor(): void {
    setEditor({ mode: "closed" });
  }

  function saveEditor(draft: InventoryItemDraft): void {
    if (editor.mode === "add") {
      append({
        description: draft.description,
        quantity: draft.quantity,
        sortOrder: fields.length,
      });
    } else if (editor.mode === "edit") {
      update(editor.index, {
        description: draft.description,
        quantity: draft.quantity,
        sortOrder: editor.index,
      });
    }
    closeEditor();
  }

  function confirmRemoveItem(index: number): void {
    const item = getValues(`items.${index}`);
    const doRemove = () => {
      remove(index);
    };

    if (!item || item.description.trim().length === 0) {
      doRemove();
      return;
    }

    NativeAlert.alert(
      "Remove this item?",
      `"${item.description.trim()}" will be discarded from this draft.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doRemove },
      ],
    );
  }

  const editorVisible = editor.mode !== "closed";
  const editorTitle =
    editor.mode === "edit" ? "Edit item" : "Add item";
  const editorDescription =
    editor.mode === "edit"
      ? (items?.[editor.index]?.description ?? "")
      : "";
  const editorQuantity =
    editor.mode === "edit"
      ? (items?.[editor.index]?.quantity ?? 1)
      : 1;

  return (
    <CreateAgreementStepLayout
      step={4}
      title="Fixtures & Fittings"
      agreementId={agreementId}
      entry={entry}
      editOrigin={editOrigin}
      onBack={onBack}
      onNext={() => void onNext()}
      nextTitle={fields.length === 0 ? "Skip" : "Next"}
      isSubmitting={isSubmitting}
      autosaveStatus={autosaveStatus}
      onBeforeCancel={cancelAutosave}
      flushAutosave={flushAutosave}
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

      {fields.length === 0 ? (
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          No fixtures & fittings yet. You can skip this step — an empty list is
          omitted from the agreement PDF.
        </Text>
      ) : null}

      {fields.map((field, index) => {
        const description = items?.[index]?.description ?? "";
        const quantity = items?.[index]?.quantity;
        const trimmed = description.trim();
        const label = `Item ${index + 1}`;
        const summary =
          trimmed.length > 0
            ? `${trimmed}${
                typeof quantity === "number" && quantity >= 1
                  ? ` × ${quantity}`
                  : ""
              }`
            : "Empty item";

        return (
          <View
            key={field.id}
            style={{
              width: "100%",
              backgroundColor: theme.colors.surfaceVariant,
              borderRadius: shape.radiusCard,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 56,
                paddingLeft: 16,
                paddingRight: 4,
                gap: 4,
              }}
            >
              <View
                style={{
                  flex: 1,
                  minHeight: 44,
                  justifyContent: "center",
                  paddingVertical: 8,
                  gap: 2,
                }}
                accessibilityLabel={`${label}: ${summary}`}
              >
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
                    color:
                      trimmed.length > 0
                        ? theme.colors.onSurface
                        : theme.colors.onSurfaceVariant,
                    fontFamily: fontFamilies.robotoRegular,
                  }}
                >
                  {summary}
                </Text>
              </View>
              <AppIconButton
                icon="pencil-outline"
                accessibilityLabel={`Edit ${label}`}
                onPress={() => openEdit(index)}
                disabled={isSubmitting}
                size={20}
              />
              <AppIconButton
                icon="delete-outline"
                accessibilityLabel={`Remove ${label}`}
                onPress={() => confirmRemoveItem(index)}
                disabled={isSubmitting}
                iconColor={theme.colors.error}
                size={20}
              />
            </View>
          </View>
        );
      })}

      <Button
        title="Add item"
        onPress={openAdd}
        isDisabled={!canAddItem}
        variant="secondary"
        textColor={theme.colors.primary}
        outlineColor={theme.colors.primary}
        icon="plus"
      />

      {submitError ? <Alert description={submitError} /> : null}

      <InventoryItemEditorSheet
        visible={editorVisible}
        title={editorTitle}
        initialDescription={editorDescription}
        initialQuantity={
          typeof editorQuantity === "number" && editorQuantity >= 1
            ? editorQuantity
            : 1
        }
        isDisabled={isSubmitting}
        onClose={closeEditor}
        onSave={saveEditor}
      />
    </CreateAgreementStepLayout>
  );
}
