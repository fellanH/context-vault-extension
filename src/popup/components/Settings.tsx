import React, { useState, useEffect } from "react";
import type { MessageType, UserProfile } from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";
import { GoogleIcon } from "@/shared/components/GoogleIcon";

interface Props {
  onSaved: (connected: boolean) => void;
}

function AvatarFallback({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground shrink-0">
      {initials}
    </div>
  );
}

export function Settings({ onSaved }: Props) {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SETTINGS.serverUrl);
  const [apiKey, setApiKey] = useState("");
  const [encryptionSecret, setEncryptionSecret] = useState("");
  const [connected, setConnected] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "get_settings" } satisfies MessageType,
      (response: MessageType) => {
        if (chrome.runtime.lastError) {
          console.warn("[context-vault]", chrome.runtime.lastError.message);
          return;
        }
        if (response?.type === "settings") {
          setServerUrl(response.serverUrl);
          setApiKey(response.apiKey);
          setEncryptionSecret(response.encryptionSecret || "");
          setConnected(response.connected);
          setUserProfile(response.userProfile ?? null);
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
          setApiKey(response.apiKey);
          setEncryptionSecret(response.encryptionSecret ?? "");
          setConnected(response.connected);
          setUserProfile(response.userProfile ?? null);
          setAvatarError(false);
          setTestResult({ success: true });
          onSaved(response.connected);
        }
      },
    );
  }

  function handleSignOut() {
    setSigningOut(true);
    setTestResult(null);
    chrome.runtime.sendMessage(
      { type: "sign_out" } satisfies MessageType,
      (response: MessageType) => {
        setSigningOut(false);
        if (chrome.runtime.lastError || !response) return;
        if (response.type === "sign_out_result" && response.success) {
          setApiKey("");
          setEncryptionSecret("");
          setConnected(false);
          setUserProfile(null);
          setAvatarError(false);
          onSaved(false);
        }
      },
    );
  }

  function handleSave() {
    chrome.runtime.sendMessage(
      {
        type: "save_settings",
        serverUrl,
        apiKey,
        encryptionSecret,
      } satisfies MessageType,
      (response: MessageType) => {
        if (chrome.runtime.lastError) {
          setTestResult({
            success: false,
            error: "Could not reach background service.",
          });
          return;
        }
        if (response?.type === "error") {
          setTestResult({ success: false, error: response.message });
          return;
        }
        if (response?.type === "settings") {
          setConnected(response.connected);
          setTestResult({ success: true });
          onSaved(response.connected);
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
              if (response.success) onSaved(true);
            }
          },
        );
      },
    );
  }

  const canSave = Boolean(serverUrl && apiKey);

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3">Settings</h3>

      {connected && userProfile ? (
        /* ── Connected via Google: profile card ── */
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            {userProfile.avatar_url && !avatarError ? (
              <img
                src={userProfile.avatar_url}
                alt={userProfile.name}
                className="w-10 h-10 rounded-full shrink-0"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <AvatarFallback name={userProfile.name} />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{userProfile.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {userProfile.email}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GoogleIcon />
              {signingIn ? "Reconnecting..." : "Reconnect"}
            </button>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex-1 py-1.5 px-3 text-xs text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>
      ) : (
        /* ── Not connected: Google sign-in primary ── */
        <div className="mb-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-3"
          >
            <GoogleIcon />
            {signingIn ? "Signing in..." : "Sign in with Google"}
          </button>
          <div className="relative flex items-center mb-3">
            <div className="flex-1 border-t border-input" />
            <span className="px-2 text-xs text-muted-foreground">
              or use an API key
            </span>
            <div className="flex-1 border-t border-input" />
          </div>
        </div>
      )}

      {/* Advanced collapsible */}
      <button
        onClick={() => setAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 cursor-pointer"
      >
        <span
          className={`inline-block transition-transform ${advanced ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        Advanced
      </button>

      {advanced && (
        <div className="space-y-2 mb-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Server URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://api.context-vault.com"
              className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg text-foreground outline-none focus:ring-1 focus:ring-ring"
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
              className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg text-foreground outline-none focus:ring-1 focus:ring-ring"
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
              className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={testing || !canSave}
              className="flex-1 py-2 px-3 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? "Testing..." : "Test"}
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 py-2 px-3 text-xs font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {testResult && (
        <div
          className={`px-3 py-2 rounded-lg text-xs ${
            testResult.success
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {testResult.success
            ? "Connected successfully"
            : `Connection failed: ${testResult.error}`}
        </div>
      )}
    </div>
  );
}
