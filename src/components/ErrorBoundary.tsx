import { Component, type ErrorInfo, type ReactNode } from "react";
import { T } from "../app/strings";
import { Bi } from "./Bi";

/**
 * Keeps one broken screen from blanking the whole app. Progress lives in IndexedDB and is untouched; the
 * learner gets a clear message and a reload button. A failed lazy chunk (new deploy, flaky network) lands here too.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("RegaDRIVE screen error", error, info.componentStack); }
  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating to another page clears the error.
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="card stack" role="alert" data-testid="error-boundary">
        <h1 className="section-title"><Bi t={T.errorTitle} /></h1>
        <Bi t={T.errorBody} />
        <div className="q-actions"><button type="button" className="btn btn-primary" onClick={() => location.reload()} data-testid="error-reload"><Bi t={T.reload} /></button></div>
      </section>
    );
  }
}
