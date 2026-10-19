import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { CREATE_AGREEMENT_GESTURE_OPTIONS } from "@/lib/agreements/createAgreementGestureOptions";
import { AppProviders } from "@/lib/providers";
import { appFontMap } from "@/lib/theme/fonts";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden in some Expo Go reloads — ignore.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFontMap);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {
        // Same as prevent — ignore if already hidden.
      });
    }
  }, [fontsLoaded, fontError]);

  // Keep native splash visible until fonts resolve (or fail). Avoids FOUT / blank flash.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppProviders>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          {/* Profile trigger is left — enter from left. Notifications stays default (from right). */}
          <Stack.Screen
            name="profile"
            options={{
              animation: "slide_from_left",
              animationMatchesGesture: true,
            }}
          />
          {/*
            Create-agreement is pushed over tabs. iOS edge-swipe is this
            screen's interactive pop (not the nested step stack) and would
            reveal Home. Nested gestureEnabled: false does not cover that.
          */}
          <Stack.Screen
            name="(create-agreement)"
            options={CREATE_AGREEMENT_GESTURE_OPTIONS}
          />
        </Stack>
      </AppProviders>
    </SafeAreaProvider>
  );
}
