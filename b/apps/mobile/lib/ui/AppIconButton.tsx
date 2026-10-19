import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { IconButton as PaperIconButton } from "react-native-paper";
import {
  iconButtonHitSlop,
  iconButtonTouchExtent,
} from "@/lib/ui/iconButtonTouchTarget";

const DEFAULT_ICON_SIZE = 24;

type PaperIconButtonProps = ComponentProps<typeof PaperIconButton>;

type Props = Omit<PaperIconButtonProps, "size"> & {
  /** Visual icon size in pt. Touch target stays ≥ 44×44 regardless. */
  size?: number;
};

/**
 * App icon button — always ≥ 44×44pt touchable.
 * Prefer this over Paper's IconButton everywhere in the app.
 */
export function AppIconButton({
  size = DEFAULT_ICON_SIZE,
  style,
  hitSlop,
  accessibilityRole = "button",
  ...rest
}: Props) {
  const extent = iconButtonTouchExtent(size);
  const defaultHitSlop = iconButtonHitSlop(size);

  return (
    <PaperIconButton
      {...rest}
      size={size}
      accessibilityRole={accessibilityRole}
      hitSlop={hitSlop ?? defaultHitSlop}
      style={[
        styles.touchTarget,
        {
          width: extent,
          height: extent,
          minWidth: extent,
          minHeight: extent,
          maxWidth: extent,
          maxHeight: extent,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    margin: 0,
  },
});
