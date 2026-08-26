import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import "./index.css";

// Mismo DSN público que shop-web/pos-web (no es secreto, solo sirve para
// mandar eventos) — solo en producción, para no ensuciar el proyecto con
// ruido de desarrollo local.
if (import.meta.env.PROD) {
  Sentry.init({ dsn: "https://5ac5ca130b6f66e11ccc34416a15edfc@o4511950705328128.ingest.us.sentry.io/4511951121481728" });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
