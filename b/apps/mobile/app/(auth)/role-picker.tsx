import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  hrefForAppRole,
  isAppRole,
  normalizeAppRoles,
  roleLabel,
  type AppRole,
} from "@/lib/auth/roleRouting";
import { saveSessionIdentity } from "@/lib/auth/secureSession";
import { replaceRoot } from "@/lib/navigation/replaceRoot";
import { Alert } from "@/lib/ui/Alert";
import { AuthScreenLayout } from "@/lib/ui/AuthScreenLayout";
import { Button } from "@/lib/ui/Button";
import { Heading, Text } from "@/lib/ui/Typography";

export default function RolePickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; roles?: string }>();
  const phone = useMemo(
    () => (params.phone ?? "").replace(/\D/g, "").slice(-10),
    [params.phone],
  );
  const roles = useMemo(
    () =>
      normalizeAppRoles(
        typeof params.roles === "string" ? params.roles.split(",") : [],
      ),
    [params.roles],
  );

  const [error, setError] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<AppRole | null>(null);

  const onPick = async (role: AppRole) => {
    if (loadingRole) return;
    setError(null);
    setLoadingRole(role);
    try {
      await saveSessionIdentity({
        phone: phone.length === 10 ? phone : undefined,
        role,
      });
      const href = await hrefForAppRole(role);
      replaceRoot(router, href);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't switch role. Check your connection and try again.",
      );
      setLoadingRole(null);
    }
  };

  const displayRoles =
    roles.length > 0
      ? roles
      : (["broker", "owner", "tenant"] as AppRole[]).filter(isAppRole);

  return (
    <AuthScreenLayout footer={null} showBack={false}>
      <View style={{ gap: 24, width: "100%" }}>
        <View style={{ gap: 8 }}>
          <Heading size="xlarge">Choose how to continue</Heading>
          <Text size="large" color="subtle">
            This number is linked to more than one role.
          </Text>
        </View>

        <View style={{ gap: 12, width: "100%" }}>
          {displayRoles.map((role) => (
            <Button
              key={role}
              title={roleLabel(role)}
              variant={role === "broker" ? "primary" : "secondary"}
              onPress={() => void onPick(role)}
              isLoading={loadingRole === role}
              isDisabled={loadingRole !== null && loadingRole !== role}
            />
          ))}
        </View>

        {error ? <Alert description={error} /> : null}
      </View>
    </AuthScreenLayout>
  );
}
