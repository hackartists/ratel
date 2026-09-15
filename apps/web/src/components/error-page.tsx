import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@ratel/ts-bridges/runtime";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { useErrorPageI18n } from "@/i18n/generated/components/error-page.i18n";
import { errorMessage } from "@/lib/server-error";

// app/ratel/src/components/error_page.rs — the error boundary around the route
// outlet (RootLayout) and around individual pages (`WrappedPage`).

export interface RedirectTo {
  target: string;
  label: string;
}

/** `common::Error` variants that mean the session is gone (Rust `is_auth_error`). */
const AUTH_ERRORS = new Set(["NoSessionFound", "UnauthorizedAccess", "UserNotFoundInContext"]);

/** Storage key the Dioxus app wipes on a dead session (`clear_cached_session`). */
const USER_CONTEXT_STORAGE_KEY = "user_context";

export function clearCachedSession(): void {
  try {
    window.localStorage.removeItem(USER_CONTEXT_STORAGE_KEY);
  } catch {
    // storage blocked
  }
}

function isAuthError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  const data = error.server?.data;
  return typeof data === "string" && AUTH_ERRORS.has(data);
}

export interface ErrorPageProps {
  error: unknown;
  redirection?: RedirectTo;
  /** Clears the boundary so the target page can render. */
  onReset: () => void;
  /** Called before leaving the page for session errors (the auth context resets the signed-in user). */
  onAuthError?: () => void;
}

export function ErrorPage({ error, redirection, onReset, onAuthError }: ErrorPageProps) {
  const tr = useErrorPageI18n();
  const navigate = useNavigate();
  const label = redirection?.label ?? tr.goHome;
  const authError = isAuthError(error);
  const message = error === undefined ? tr.description : errorMessage(error);

  return (
    <div className="flex flex-col gap-6 justify-center items-center py-16 px-6 w-full min-h-screen bg-background">
      <div className="flex flex-col gap-3 items-center max-w-md text-center">
        <h1 className="text-2xl font-bold text-text-primary">{tr.title}</h1>
        <p className="text-sm text-foreground-muted">{message}</p>
      </div>
      <div className="flex flex-row gap-3">
        <Button
          buttonStyle={ButtonStyle.Primary}
          shape={ButtonShape.Rounded}
          onClick={() => {
            if (authError) {
              onAuthError?.();
              clearCachedSession();
            }
            onReset();
            navigate(redirection?.target ?? "/");
          }}
        >
          {label}
        </Button>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  redirection?: RedirectTo;
  onAuthError?: () => void;
}

interface ErrorBoundaryState {
  error: unknown;
  hasError: boolean;
}

/** Dioxus `ErrorBoundary { handle_error: ErrorPage }`. */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: undefined, hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error("Error in component tree:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: undefined, hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <ErrorPage
        error={this.state.error}
        redirection={this.props.redirection}
        onReset={this.reset}
        onAuthError={this.props.onAuthError}
      />
    );
  }
}

/** Rust `WrappedPage`: a page-level error boundary with an optional redirect button. */
export function WrappedPage({ children, redirection }: { children: React.ReactNode; redirection?: RedirectTo }) {
  return <ErrorBoundary redirection={redirection}>{children}</ErrorBoundary>;
}
