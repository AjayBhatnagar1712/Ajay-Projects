import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import LottieView from "lottie-react-native";
import splashAnimation from "@/assets/animations/splash.json";
import {
  resolveLaunchDestination,
  type LaunchDestination,
} from "@/lib/auth/resolveLaunchDestination";
import { replaceRoot } from "@/lib/navigation/replaceRoot";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { ErrorRecoveryActions } from "@/lib/ui/ErrorRecoveryActions";
import { Text } from "@/lib/ui/Typography";

/**
 * Animated splash — Lottie only (mark, no wordmark).
 *
 * Asset: ~1.9s (115 frames @ 60fps), transparent canvas. Container uses
 * theme.colors.surface (#FFFFFF) so the mark sits on solid white — not the
 * app background (#F8FAFC) and not an undefined/black fill.
 *
 * Timing: play once (loop=false). Navigate only after both (1) the gate has
 * resolved and (2) that first play has finished (~1.9s floor). If the gate is
 * slower, hold the last frame — do not loop/restart (a second play would get
 * cut mid-animation). At 1.9s the one-play floor is still enough brand time
 * without feeling padded vs typical session/profile resolve.
 */
export default function SplashScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [destination, setDestination] = useState<LaunchDestination | null>(null);
  const [playComplete, setPlayComplete] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const navigatedRef = useRef(false);
  const gateStartedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setDestination(null);
    setPlayComplete(false);
    navigatedRef.current = false;
    gateStartedAtRef.current = Date.now();

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[splash] gate start");
    }

    void (async () => {
      const result = await resolveLaunchDestination();
      if (cancelled) return;
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.log("[splash] gate done", {
          ms: Date.now() - gateStartedAtRef.current,
          status: result.status,
          href: result.status === "ready" ? result.href : undefined,
        });
      }
      setDestination(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  useEffect(() => {
    if (!destination || !playComplete || navigatedRef.current) return;
    if (destination.status === "error") return;

    navigatedRef.current = true;
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[splash] navigate", {
        totalMs: Date.now() - gateStartedAtRef.current,
        status: destination.status,
      });
    }
    if (destination.status === "session_expired") {
      replaceRoot(router, "/(auth)/session-expired");
      return;
    }
    replaceRoot(router, destination.href as Href);
  }, [destination, playComplete, router]);

  const showError = destination?.status === "error";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityLabel="TrustKeyper splash"
    >
      {showError ? (
        <View style={{ width: "100%", paddingHorizontal: 24, gap: 16 }}>
          <Text color="subtle">{destination.message}</Text>
          <ErrorRecoveryActions
            variant="unknown"
            onRetry={() => {
              setPlayComplete(false);
              setRetryToken((n) => n + 1);
            }}
          />
        </View>
      ) : (
        <LottieView
          source={splashAnimation}
          autoPlay
          loop={false}
          onAnimationFinish={(isCancelled) => {
            if (isCancelled) return;
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.log("[splash] animation finish", {
                ms: Date.now() - gateStartedAtRef.current,
                gateReady: destination !== null,
              });
            }
            setPlayComplete(true);
          }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}
