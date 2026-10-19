import type { ReactNode } from "react";
import { PaperProvider } from "react-native-paper";
import { trustKeyperTheme } from "@/lib/theme/paperTheme";

type Props = {
  children: ReactNode;
};

/** App-wide Paper theme — TrustKeyper tokens from lib/theme. */
export function PaperRoot({ children }: Props) {
  return <PaperProvider theme={trustKeyperTheme}>{children}</PaperProvider>;
}
