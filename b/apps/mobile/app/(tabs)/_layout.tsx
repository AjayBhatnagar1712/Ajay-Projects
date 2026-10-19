import { Tabs } from "expo-router";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { useRequireOnboardingComplete } from "@/lib/broker/useRequireOnboardingComplete";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { FloatingTabBar } from "@/lib/ui/FloatingTabBar";

export default function TabsLayout() {
  const theme = useAppTheme();
  const gate = useRequireOnboardingComplete();

  if (gate.status !== "allowed") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
          paddingHorizontal: 24,
        }}
      >
        <Text
          variant="bodyLarge"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoRegular,
            textAlign: "center",
          }}
        >
          {gate.status === "loading"
            ? "Loading…"
            : "Continuing onboarding…"}
        </Text>
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="agreements" options={{ title: "Agreements" }} />
      <Tabs.Screen name="records" options={{ title: "Records" }} />
      <Tabs.Screen name="payments" options={{ title: "Payments" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
