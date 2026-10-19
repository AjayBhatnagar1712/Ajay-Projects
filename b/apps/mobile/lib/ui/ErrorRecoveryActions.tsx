import { useRouter } from "expo-router";
import { useState } from "react";
import { signOut } from "@/lib/auth/phoneOtp";
import { replaceRoot } from "@/lib/navigation/replaceRoot";
import { StateScreen } from "@/lib/ui/StateScreen";

type Variant = "connection" | "unknown";

type Props = {
  onRetry: () => void;
  /** Defaults to connection-problem copy from Figma. */
  variant?: Variant;
};

const COPY: Record<
  Variant,
  { icon: string; title: string; description: string }
> = {
  connection: {
    icon: "wifi-off",
    title: "Couldn't connect",
    description: "Check your connection and try again.",
  },
  unknown: {
    icon: "alert-circle-outline",
    title: "Something went wrong",
    description: "Please try again.",
  },
};

/**
 * Full-screen load failure escape hatch — StateScreen + Try again / Sign out.
 * Retry alone is not enough when the session is dead — always offer Sign out.
 */
export function ErrorRecoveryActions({ onRetry, variant = "connection" }: Props) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const copy = COPY[variant];

  const onSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      replaceRoot(router, "/(auth)/splash");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <StateScreen
      icon={copy.icon}
      title={copy.title}
      description={copy.description}
      primaryAction={{
        title: "Try again",
        onPress: onRetry,
        isDisabled: isSigningOut,
      }}
      secondaryAction={{
        title: "Sign out",
        onPress: () => void onSignOut(),
        isDisabled: isSigningOut,
        isLoading: isSigningOut,
      }}
    />
  );
}
