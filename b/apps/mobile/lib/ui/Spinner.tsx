import { ActivityIndicator } from "react-native-paper";

type Props = {
  accessibilityLabel?: string;
};

export function Spinner({ accessibilityLabel = "Loading" }: Props) {
  return <ActivityIndicator size="large" accessibilityLabel={accessibilityLabel} />;
}
