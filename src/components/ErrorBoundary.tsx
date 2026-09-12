import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Erro capturado:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "monospace",
            color: "#fff",
            background: "#111",
            minHeight: "100vh",
          }}
        >
          <h2 style={{ color: "#f87171", fontSize: 18, fontWeight: 700 }}>
            O app encontrou um erro:
          </h2>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "12px 0" }}>
            {this.state.error.message}
          </pre>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, opacity: 0.75 }}>
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer", borderRadius: 6 }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
