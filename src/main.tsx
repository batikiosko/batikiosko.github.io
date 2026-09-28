import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import "./index.css";
import { catalogConfig } from "./catalog/runtime.js";
import { PwaControls } from "./components/PwaControls.js";

// Each business chooses its reporting project; development never reports.
if (import.meta.env.PROD && catalogConfig.observability.sentryDsn) {
  Sentry.init({ dsn: catalogConfig.observability.sentryDsn });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <PwaControls />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
