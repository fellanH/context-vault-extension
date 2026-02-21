import React, { useState } from "react";
import type { MessageType } from "@/shared/types";

interface Props {
  serverUrl: string;
  apiKey: string;
  encryptionSecret: string;
  onServerUrlChange: (url: string) => void;
  onApiKeyChange: (key: string) => void;
  onEncryptionSecretChange: (secret: string) => void;
  onConnected: () => void;
}

export function ConnectStep({
  serverUrl,
  apiKey,
  encryptionSecret,
  onServerUrlChange,
  onApiKeyChange,
  onEncryptionSecretChange,
  onConnected,
}: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

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
      <p className="text-sm text-muted-foreground mb-2">
        Sign up at{" "}
        <a
          href="https://app.context-vault.com"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          app.context-vault.com
        </a>{" "}
        to get your API key, then paste it below.
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        Or connect via terminal:{" "}
        <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground">
          npx context-vault connect --key cv_...
        </code>
      </p>

      <label className="block text-xs text-muted-foreground mb-1">
        Server URL
      </label>
      <input
        type="url"
        value={serverUrl}
        onChange={(e) => onServerUrlChange(e.target.value)}
        placeholder="https://api.context-vault.com"
        className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-xl text-foreground outline-none focus:ring-1 focus:ring-ring mb-4"
      />

      <label className="block text-xs text-muted-foreground mb-1">
        API Key
      </label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        placeholder="cv_..."
        className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-xl text-foreground outline-none focus:ring-1 focus:ring-ring mb-4"
      />

      <label className="block text-xs text-muted-foreground mb-1">
        Encryption Secret
      </label>
      <input
        type="password"
        value={encryptionSecret}
        onChange={(e) => onEncryptionSecretChange(e.target.value)}
        placeholder="Optional"
        className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-xl text-foreground outline-none focus:ring-1 focus:ring-ring mb-1"
      />
      <p className="text-xs text-muted-foreground mb-5">
        Optional — for split-authority encrypted vaults.
      </p>

      {testResult && (
        <div
          className={`px-3.5 py-2.5 mb-4 rounded-xl text-sm ${
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

      <button
        onClick={handleTest}
        disabled={testing || !canTest}
        className="w-full py-3 text-[15px] font-medium bg-foreground text-background rounded-xl hover:bg-foreground/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {testing ? "Testing..." : "Test Connection"}
      </button>
    </div>
  );
}
