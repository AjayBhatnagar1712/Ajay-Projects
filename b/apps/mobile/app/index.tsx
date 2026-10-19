import { Redirect } from "expo-router";

/** App entry always opens the animated splash, which decides the next route. */
export default function Index() {
  return <Redirect href="/(auth)/splash" />;
}
