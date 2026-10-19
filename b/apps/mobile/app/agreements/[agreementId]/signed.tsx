import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import {
  buildLeaseAgreementPreviewHtml,
  downloadLeaseAgreementSignedPdf,
} from "@/lib/agreements/preview";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { Stack } from "@/lib/ui/Stack";
import { Spinner } from "@/lib/ui/Spinner";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { Text } from "@/lib/ui/Typography";

function routeId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function SignedLeaseAgreementScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ agreementId?: string | string[] }>();
  const agreementId = routeId(params.agreementId);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const signedQuery = useQuery({
    queryKey: ["lease-agreement-signed-pdf", agreementId],
    queryFn: () => downloadLeaseAgreementSignedPdf(agreementId ?? ""),
    enabled: agreementId !== undefined,
  });

  function goBack(): void {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/agreements");
  }

  if (!agreementId) {
    return (
      <ScreenSafeArea>
        <StackScreenHeader title="Signed PDF" fallbackHref="/(tabs)/agreements" />
        <Alert description="No agreement was selected." />
        <Button title="Back to agreements" onPress={goBack} />
      </ScreenSafeArea>
    );
  }

  if (signedQuery.isLoading) {
    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Signed PDF" fallbackHref="/(tabs)/agreements" />
        <Stack gap="spacing.4">
          <Spinner accessibilityLabel="Loading signed PDF" />
          <Text color="subtle">Loading the signed agreement…</Text>
        </Stack>
      </ScreenSafeArea>
    );
  }

  if (signedQuery.error || !signedQuery.data) {
    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Signed PDF" fallbackHref="/(tabs)/agreements" />
        <Alert
          color="negative"
          title="Could not load signed PDF"
          description={
            signedQuery.error instanceof Error
              ? signedQuery.error.message
              : "The signed agreement could not be downloaded."
          }
        />
        <Button title="Try again" onPress={() => void signedQuery.refetch()} />
        <Button
          title="Back to agreements"
          variant="secondary"
          textColor={theme.colors.primary}
          outlineColor={theme.colors.primary}
          onPress={goBack}
        />
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea scroll={false}>
      <StackScreenHeader title="Signed PDF" fallbackHref="/(tabs)/agreements" />
      {pdfError ? (
        <Alert color="negative" title="Could not display PDF" description={pdfError} />
      ) : null}
      <View style={{ flex: 1 }}>
        <WebView
          originWhitelist={["*"]}
          source={{ html: buildLeaseAgreementPreviewHtml(signedQuery.data.base64) }}
          onMessage={(event) => {
            try {
              const payload = JSON.parse(event.nativeEvent.data) as { type?: string; message?: string };
              if (payload.type === "error") {
                setPdfError(payload.message ?? "The signed PDF could not be rendered.");
              }
            } catch {
              setPdfError("The signed PDF sent an unreadable response.");
            }
          }}
        />
      </View>
    </ScreenSafeArea>
  );
}
