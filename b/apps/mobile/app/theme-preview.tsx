/**
 * Visual QA route for mobile design tokens.
 * Open in Expo Go / web: /theme-preview
 */
import { Text as PaperText } from "react-native-paper";
import { View } from "react-native";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { semantic } from "@/lib/theme/colors";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { AppIconButton } from "@/lib/ui/AppIconButton";
import { Button } from "@/lib/ui/Button";
import { Card } from "@/lib/ui/Card";
import { Stack } from "@/lib/ui/Stack";
import { TextField } from "@/lib/ui/TextField";
import { Heading, Text } from "@/lib/ui/Typography";

export default function ThemePreviewScreen() {
  const theme = useAppTheme();

  return (
    <ScreenSafeArea>
      <Stack gap="spacing.3">
        <Heading size="large">Home</Heading>
        <Text color="subtle">Create and manage lease agreements from your phone.</Text>
      </Stack>

      <Button title="Create agreement" onPress={() => undefined} />
      <Text color="subtle">
        Shared CTA: height {shape.buttonHeight} · pill radius{" "}
        {shape.buttonHeight / 2}
      </Text>

      <Card title="Form sample">
        <Stack gap="spacing.3">
          <TextField
            label="Property address"
            value="12 MG Road, Bengaluru"
            onChangeText={() => undefined}
          />
          <TextField
            label="Monthly rent"
            value="45000"
            onChangeText={() => undefined}
            keyboardType="number"
          />
        </Stack>
      </Card>

      <Alert
        color="positive"
        title="All parties approved"
        description="Ready to send for signing."
      />

      <View
        accessibilityRole="text"
        accessibilityLabel="Success chip on emerald-400"
        style={{
          alignSelf: "flex-start",
          backgroundColor: semantic.success,
          borderRadius: shape.radiusChip,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <PaperText
          variant="labelLarge"
          style={{
            color: theme.colors.onSuccess,
            fontFamily: theme.fonts.labelLarge.fontFamily,
          }}
        >
          Signed · onSuccess on emerald-400
        </PaperText>
      </View>

      <Stack gap="spacing.3">
        <Text color="subtle">AppIconButton (min 44×44 touch)</Text>
        <AppIconButton
          icon="close"
          accessibilityLabel="Close preview"
          onPress={() => undefined}
        />
      </Stack>
    </ScreenSafeArea>
  );
}
