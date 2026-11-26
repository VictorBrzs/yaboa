import { createRoot } from "react-dom/client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";
import App from "./app/App.tsx";
import { supabase } from "./lib/supabase";
import "./styles/index.css";

type BoundaryState = { failed: boolean };

class StartupErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("Falha ao abrir o Yaboa", error);
  }

  render() {
    return this.state.failed ? <RecoveryScreen /> : this.props.children;
  }
}

function RecoveryScreen() {
  const panelStyle = {
    width: "min(440px, calc(100% - 40px))",
    margin: "10vh auto",
    padding: "28px",
    borderRadius: "20px",
    background: "#ffffff",
    color: "#431407",
    boxShadow: "0 16px 40px rgba(154, 52, 18, 0.16)",
    fontFamily: "system-ui, sans-serif",
    textAlign: "center" as const,
  };

  function clearSessionAndReload() {
    void supabase.auth.signOut({ scope: "local" }).then(
      () => window.location.reload(),
      () => window.location.reload(),
    );
  }

  return (
    <main role="alert" style={panelStyle}>
      <h1 style={{ margin: "0 0 12px", fontSize: "1.5rem" }}>O Yaboa não conseguiu abrir</h1>
      <p style={{ lineHeight: 1.5 }}>Recarregue o app. Se continuar, limpe a sessão salva deste navegador e tente entrar novamente.</p>
      <button type="button" onClick={() => window.location.reload()} style={recoveryButtonStyle}>Recarregar</button>
      <button type="button" onClick={clearSessionAndReload} style={{ ...recoveryButtonStyle, background: "#9a3412" }}>
        Limpar sessão e recarregar
      </button>
    </main>
  );
}

const recoveryButtonStyle = {
  width: "100%",
  minHeight: "48px",
  marginTop: "10px",
  border: 0,
  borderRadius: "12px",
  background: "#f97316",
  color: "#ffffff",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
};

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Elemento raiz do Yaboa não encontrado.");

const root = createRoot(rootElement);
root.render(<StartupErrorBoundary><App /></StartupErrorBoundary>);

// Never leave a user staring at an empty screen if startup code fails silently.
window.setTimeout(() => {
  if (!rootElement.textContent?.trim()) root.render(<RecoveryScreen />);
}, 8000);

window.addEventListener("error", (event) => {
  if (event.error) root.render(<RecoveryScreen />);
});

window.addEventListener("unhandledrejection", () => root.render(<RecoveryScreen />));
