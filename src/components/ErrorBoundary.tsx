import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Sin esto, un error de React tumba toda la vidriera a blanco para
 * cualquier cliente que la esté mirando, sin ningún mensaje. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Error no controlado en catalog-web:", error, info.componentStack);
    Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack ?? undefined } } });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--catalog-font-body)", textAlign: "center" }}>
        <div>
          <p style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 22, marginBottom: 10 }}>Algo salió mal</p>
          <p style={{ color: "var(--catalog-muted)", marginBottom: 20, maxWidth: 380 }}>
            El catálogo tuvo un error inesperado. Recargá la página para volver a intentar.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "var(--catalog-primary)", color: "#fff", border: 0, borderRadius: 999, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
