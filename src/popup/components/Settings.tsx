import React, { useState, useEffect } from "react";
import type { MessageType } from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";

interface Props {
  onSaved: (connected: boolean) => void;
}

export function Settings({ onSaved }: Props) {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SETTINGS.serverUrl);
  const [apiKey, setApiKey] = useState("");
  const [encryptionSecret, setEncryptionSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "get_settings" },
      (response: MessageType) => {
        if (chrome.runtime.lastError) {
          console.warn("[context-vault]", chrome.runtime.lastError.message);
          return;
        }
        if (response?.type === "settings") {
          setServerUrl(response.serverUrl);
          setApiKey(response.apiKey);
          setEncryptionSecret(response.encryptionSecret || "");
        }
      },
    );
  }, []);

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
          { type: "test_connection" },
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

      <label className="block text-xs text-muted-foreground mb-1">
        Server URL
      </label>
      <input
        type="url"
        value={serverUrl}
        onChange={(e) => setServerUrl(e.target.value)}
        placeholder="https://app.context-vault.com"
        className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg text-foreground outline-none focus:ring-1 focus:ring-ring mb-3"
      />

      <label className="block text-xs text-muted-foreground mb-1">
        API Key
      </label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="cv_..."
        className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg text-foreground outline-none focus:ring-1 focus:ring-ring mb-3"
      />

      <label className="block text-xs text-muted-foreground mb-1">
        Encryption Secret
      </label>
      <input
        type="password"
        value={encryptionSecret}
        onChange={(e) => setEncryptionSecret(e.target.value)}
        placeholder="Optional"
        className="w-full px-3 py-2 text-sm bg-input-background border border-input rounded-lg text-foreground outline-none focus:ring-1 focus:ring-ring mb-1"
      />
      <p className="text-xs text-muted-foreground mb-4">
        Optional — for split-authority encrypted vaults.
      </p>

      {testResult && (
        <div
          className={`px-3 py-2 mb-3 rounded-lg text-sm ${
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

      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={testing || !canSave}
          className="flex-1 py-2 px-4 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 py-2 px-4 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  );
}
