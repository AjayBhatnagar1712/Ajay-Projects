import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initAppStorage } from "./lib/initAppStorage";
import { initAppSentry } from "./lib/sentry";
import "./index.css";

const sentryEnabled = initAppSentry();

initAppStorage();

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Unable to start TrustKeyper: root element is missing.");
}

const reactErrorHandler = sentryEnabled
  ? Sentry.reactErrorHandler()
  : undefined;

createRoot(
  rootElement,
  reactErrorHandler === undefined
    ? undefined
    : {
        onCaughtError: reactErrorHandler,
        onRecoverableError: reactErrorHandler,
        onUncaughtError: reactErrorHandler,
      },
).render(<App />);
