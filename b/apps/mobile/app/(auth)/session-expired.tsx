import { useRouter } from "expo-router";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { StateScreen } from "@/lib/ui/StateScreen";

/**
 * Shown when a previously stored session can no longer be restored (401 / expired).
 * Sign in clears into the normal phone OTP path.
 */
export default function SessionExpiredScreen() {
  const router = useRouter();

  return (
    <ScreenSafeArea scroll={false}>
      <StateScreen
        icon="alert-circle-outline"
        title="Your session has expired"
        description="Please sign in again to continue."
        primaryAction={{
          title: "Sign in",
          onPress: () => router.replace("/(auth)/phone"),
        }}
      />
    </ScreenSafeArea>
  );
}
