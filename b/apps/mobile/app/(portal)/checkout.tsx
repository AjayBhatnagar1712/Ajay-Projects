import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { formatAgreementMoney } from "@/lib/agreements/flow";
import {
  buildCheckoutHtml,
  checkoutNavigationScheme,
  isCheckoutWebViewUrl,
  parseCheckoutMessage,
} from "@/lib/payments/portalCheckout";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { Stack } from "@/lib/ui/Stack";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { Heading, Text } from "@/lib/ui/Typography";

export default function PortalCheckoutScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const handledRef = useRef(false);
  const params = useLocalSearchParams<{
    agreementId?: string;
    orderId?: string;
    keyId?: string;
    amountPaise?: string;
    description?: string;
  }>();

  const agreementId =
    typeof params.agreementId === "string" ? params.agreementId : "";
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const keyId = typeof params.keyId === "string" ? params.keyId : "";
  const amountPaise = Number(params.amountPaise ?? "");
  const description =
    typeof params.description === "string" ? params.description : "Payment";

  const [phase, setPhase] = useState<"checkout" | "success" | "failure">(
    "checkout",
  );
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const html = useMemo(() => {
    if (!orderId || !keyId || !Number.isFinite(amountPaise) || amountPaise <= 0) {
      return null;
    }
    return buildCheckoutHtml({
      keyId,
      orderId,
      amountPaise,
      description,
    });
  }, [amountPaise, description, keyId, orderId]);

  const agreementHref: Href =
    agreementId.length > 0
      ? ({
          pathname: "/(portal)/agreement/[agreementId]",
          params: { agreementId },
        } as Href)
      : ("/(portal)/home" as Href);

  const portalHome: Href = "/(portal)/home" as Href;

  const invalidatePortal = async () => {
    await queryClient.invalidateQueries({ queryKey: ["portal-agreements"] });
    if (agreementId) {
      await queryClient.invalidateQueries({
        queryKey: ["portal-agreement", agreementId],
      });
    }
  };

  const finishSuccess = async (id?: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (id) setPaymentId(id);
    setPhase("success");
    await invalidatePortal();
  };

  const returnToAgreement = async () => {
    await invalidatePortal();
    router.replace(agreementHref);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parseCheckoutMessage(event.nativeEvent.data);
    if (!message) return;

    if (message.type === "success") {
      void finishSuccess(message.paymentId);
      return;
    }
    if (message.type === "failure") {
      if (handledRef.current) return;
      handledRef.current = true;
      setPhase("failure");
      setErrorMessage(message.reason ?? "Payment failed");
      void invalidatePortal();
      return;
    }
    if (message.type === "dismiss") {
      if (handledRef.current) return;
      void returnToAgreement();
    }
  };

  const onDone = () => {
    void returnToAgreement();
  };

  const openExternalCheckoutUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        throw new Error("No compatible payment app is installed.");
      }
      await Linking.openURL(url);
    } catch (error) {
      if (handledRef.current) return;
      handledRef.current = true;
      setPhase("failure");
      const scheme = checkoutNavigationScheme(url).replace(/:$/, "");
      setErrorMessage(
        error instanceof Error
          ? `${error.message} Checkout could not open the ${scheme} payment link.`
          : `Checkout could not open the ${scheme} payment link.`,
      );
    }
  };

  if (phase === "success") {
    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Payment complete" fallbackHref={portalHome} />
        <Stack gap="spacing.4" fill>
          <Heading size="small">Payment successful</Heading>
          <Text color="subtle">
            {description} of {formatAgreementMoney(amountPaise)} was received.
          </Text>
          {paymentId ? (
            <Text size="small" color="subtle">
              Payment ID: {paymentId}
            </Text>
          ) : null}
          {orderId ? (
            <Text size="small" color="subtle">
              Order ID: {orderId}
            </Text>
          ) : null}
          <Text color="subtle">
            Your agreement will update shortly. Return to the portal to confirm
            the paid status.
          </Text>
          <Button title="Back to agreement" onPress={onDone} />
        </Stack>
      </ScreenSafeArea>
    );
  }

  if (phase === "failure") {
    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Checkout" fallbackHref={agreementHref} />
        <Stack gap="spacing.4" fill>
          <Alert
            description={`${errorMessage ?? "Checkout did not confirm payment."} Return to the agreement to verify the payment status before trying again.`}
          />
          <Button
            title="Back to agreement"
            variant="secondary"
            onPress={() => void returnToAgreement()}
          />
        </Stack>
      </ScreenSafeArea>
    );
  }

  // Native wrapper only: inset the WebView for notch / home indicator. Razorpay's
  // own checkout HTML cannot be restyled from here — it will still paint edge-to-
  // edge inside the WebView bounds.
  return (
    <SafeAreaView
      edges={["top", "right", "bottom", "left"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <StackScreenHeader title="Checkout" fallbackHref={agreementHref} />
      {!html ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Alert description="Missing payment details. Go back and try again." />
          <Button
            title="Back"
            variant="secondary"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace(agreementHref);
            }}
          />
        </View>
      ) : (
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(request) => {
            if (isCheckoutWebViewUrl(request.url)) return true;
            void openExternalCheckoutUrl(request.url);
            return false;
          }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          style={{ flex: 1, width: "100%", backgroundColor: "#ffffff" }}
          containerStyle={{ flex: 1 }}
        />
      )}
    </SafeAreaView>
  );
}
