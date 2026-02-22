import React, { useState, useEffect } from "react";
import type { MessageType } from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";
import { GoogleIcon } from "@/shared/components/GoogleIcon";

interface Props {
  onConnected: () => void;
}

export function ConnectStep({ onConnected }: Props) {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SETTINGS.serverUrl);
  const [apiKey, setApiKey] = useState("");
  const [encryptionSecret, setEncryptionSecret] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  // Load stored settings on mount; auto-expand advanced if custom server URL
  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "get_settings" } satisfies MessageType,
      (response: MessageType) => {
        if (chrome.runtime.lastError || !response) return;
        if (response.type === "settings") {
          setServerUrl(response.serverUrl);
          setApiKey(response.apiKey);
          setEncryptionSecret(response.encryptionSecret ?? "");
          if (response.serverUrl !== DEFAULT_SETTINGS.serverUrl) {
            setAdvanced(true);
          }
        }
      },
    );
  }, []);

  function handleGoogleSignIn() {
    setSigningIn(true);
    setTestResult(null);
    chrome.runtime.sendMessage(
      { type: "google_auth_start" } satisfies MessageType,
      (response: MessageType) => {
        setSigningIn(false);
        if (chrome.runtime.lastError || !response) {
          setTestResult({
            success: false,
            error: "Could not reach background service.",
          });
          return;
        }
        if (response.type === "error") {
          setTestResult({ success: false, error: response.message });
          return;
        }
        if (response.type === "settings") {
          setTestResult({ success: true });
          setTimeout(() => onConnected(), 800);
        }
      },
    );
  }

  function handleTest() {
    setTesting(true);
    setTestResult(null);

    chrome.runtime.sendMessage(
      {
        type: "save_settings",
        serverUrl,
        apiKey,
        encryptionSecret,
      } satisfies MessageType,
      (saveResponse: MessageType) => {
        if (chrome.runtime.lastError) {
          setTesting(false);
          setTestResult({
            success: false,
            error: "Could not reach background service.",
          });
          return;
        }
        if (saveResponse?.type === "error") {
          setTesting(false);
          setTestResult({ success: false, error: saveResponse.message });
          return;
        }
        chrome.runtime.sendMessage(
          { type: "test_connection" } satisfies MessageType,
          (response: MessageType) => {
            if (chrome.runtime.lastError) {
              setTesting(false);
              setTestResult({
                success: false,
                error: "Could not reach background service.",
              });
              return;
            }
            setTesting(false);
            if (response?.type === "connection_result") {
              setTestResult(response);
              if (response.success) {
                setTimeout(() => onConnected(), 800);
              }
            }
          },
        );
      },
    );
  }

  const canTest = Boolean(serverUrl && apiKey);

  return (
    <div className="w-full max-w-[480px] px-8 py-12">
      <h2 className="text-2xl font-bold mb-2">Connect Your Vault</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Sign in with Google to connect to your Context Vault.
      </p>

      {/* Primary: Google sign-in */}
      <button
        onClick={handleGoogleSignIn}
        disabled={signingIn}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 text-[15px] font-medium bg-foreground text-background rounded-xl hover:bg-foreground/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-4"
      >
        <GoogleIcon />
        {signingIn ? "Signing in..." : "Sign in with Google"}
      </button>

      {/* Divider */}
      <div className="relative flex items-center mb-4">
        <div className="flex-1 border-t border-input" />
        <span className="px-2 text-xs text-muted-foreground">
          or use an API key
        </span>
        <div className="flex-1 border-t border-input" />
      </div>

      {/* Advanced collapsible */}
      <button
        onClick={() => setAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 cursor-pointer"
      >
        <span
          className={`inline-block transition-transform ${advanced ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        Advanced
      </button>

      {advanced && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Server URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://api.context-vault.com"
              className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-xl text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="cv_..."
              className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-xl text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Encryption Secret
            </label>
            <input
              type="password"
              value={encryptionSecret}
              onChange={(e) => setEncryptionSecret(e.target.value)}
              placeholder="Optional"
              className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-xl text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional — for split-authority encrypted vaults.
            </p>
          </div>
          <button
            onClick={handleTest}
            disabled={testing || !canTest}
            className="w-full py-2.5 text-sm font-medium bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>
      )}

      {testResult && (
        <div
          className={`px-3.5 py-2.5 rounded-xl text-sm ${
            testResult.success
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {testResult.success
            ? "Connected successfully!"
            : `Connection failed: ${testResult.error}`}
        </div>
      )}
    </div>
  );
}
