import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text as PaperText } from "react-native-paper";
import { getAccountRoles } from "@/lib/api/client";
import {
  hrefForAppRole,
  isAppRole,
  normalizeAppRoles,
  roleLabel,
  type AppRole,
} from "@/lib/auth/roleRouting";
import { loadStoredSession, saveSessionIdentity } from "@/lib/auth/secureSession";
import { replaceRoot } from "@/lib/navigation/replaceRoot";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Text } from "@/lib/ui/Typography";

type Props = {
  /** Current active role for label; when omitted, loaded from SecureStore. */
  currentRole?: AppRole | null;
};

/**
 * Compact role switcher — only renders when the phone has multiple app roles.
 */
export function RoleSwitcher({ currentRole }: Props) {
  const theme = useAppTheme();
  const router = useRouter();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["stored-session"],
    queryFn: loadStoredSession,
  });

  const phone = sessionQuery.data?.phone?.replace(/\D/g, "").slice(-10) ?? "";
  const activeRole: AppRole | null =
    currentRole ??
    (isAppRole(sessionQuery.data?.role) ? sessionQuery.data.role : null);

  const rolesQuery = useQuery({
    queryKey: ["account-roles", phone],
    queryFn: () => getAccountRoles(phone),
    enabled: phone.length === 10,
  });

  const roles = normalizeAppRoles(rolesQuery.data?.roles ?? []);
  if (roles.length < 2) return null;

  const otherRoles = roles.filter((role) => role !== activeRole);

  const onSwitch = async (role: AppRole) => {
    if (isSwitching) return;
    setSwitchError(null);
    setIsSwitching(true);
    try {
      await saveSessionIdentity({
        phone: phone.length === 10 ? phone : undefined,
        role,
      });
      const href = await hrefForAppRole(role);
      replaceRoot(router, href);
    } catch (err) {
      setSwitchError(
        err instanceof Error
          ? err.message
          : "Couldn't switch role. Try again.",
      );
      setIsSwitching(false);
    }
  };

  return (
    <View style={{ width: "100%", gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text size="small" color="subtle">
          Signed in as {activeRole ? roleLabel(activeRole) : "…"}
        </Text>
        {otherRoles.map((role) => (
          <Pressable
            key={role}
            onPress={() => void onSwitch(role)}
            disabled={isSwitching}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${roleLabel(role)}`}
            style={{
              minHeight: 32,
              paddingHorizontal: 10,
              justifyContent: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.colors.border,
              opacity: isSwitching ? 0.5 : 1,
            }}
          >
            <PaperText
              variant="labelMedium"
              style={{
                color: theme.colors.primary,
                fontFamily: fontFamilies.robotoMedium,
              }}
            >
              Switch to {roleLabel(role)}
            </PaperText>
          </Pressable>
        ))}
      </View>
      {switchError ? <Alert description={switchError} /> : null}
    </View>
  );
}
