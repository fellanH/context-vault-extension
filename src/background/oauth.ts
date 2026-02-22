/**
 * OAuth tab lifecycle management for Google Sign-In.
 * Opens an auth tab, watches for the callback URL, and resolves with the token.
 */

export interface OAuthResult {
  apiKey: string;
  encryptionSecret?: string;
}

// Module-level state (volatile, kept alive by the open message channel)
let pendingTabId: number | null = null;
let pendingResolve: ((r: OAuthResult) => void) | null = null;
let pendingReject: ((e: Error) => void) | null = null;
let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

const OAUTH_START_URL = "https://api.context-vault.com/api/auth/google";
const CALLBACK_HOST = "app.context-vault.com";
const CALLBACK_PATH = "/auth/callback";
const TIMEOUT_MS = 5 * 60 * 1000;

function cleanup(): void {
  if (pendingTimeout !== null) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
  pendingTabId = null;
  pendingResolve = null;
  pendingReject = null;
}

function reject(err: Error): void {
  const rej = pendingReject;
  const tabId = pendingTabId;
  cleanup();
  if (tabId !== null) {
    chrome.tabs.remove(tabId).catch(() => {
      // Tab may already be closed
    });
  }
  rej?.(err);
}

/** Called by tabs.onUpdated listener in index.ts for every tab update */
export function handleOAuthTabUpdate(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
): void {
  if (pendingTabId === null || tabId !== pendingTabId) return;
  if (!changeInfo.url) return;

  let parsed: URL;
  try {
    parsed = new URL(changeInfo.url);
  } catch {
    return;
  }

  if (parsed.host !== CALLBACK_HOST || parsed.pathname !== CALLBACK_PATH) {
    return;
  }

  // Parse token from URL fragment
  const params = new URLSearchParams(parsed.hash.slice(1));
  const token = params.get("token");
  const encryptionSecret = params.get("encryption_secret") ?? undefined;

  const res = pendingResolve;
  const tabToClose = pendingTabId;
  cleanup();

  chrome.tabs.remove(tabToClose).catch(() => {
    // Tab may already be closed
  });

  if (!token) {
    res?.({ apiKey: "", encryptionSecret } as OAuthResult);
    return;
  }

  res?.({ apiKey: token, encryptionSecret });
}

/** Opens the auth tab and returns a Promise that resolves with the token */
export async function startGoogleOAuth(): Promise<OAuthResult> {
  if (pendingTabId !== null) {
    throw new Error(
      "Sign-in already in progress. Please complete or close the existing sign-in tab.",
    );
  }

  return new Promise<OAuthResult>((resolve, rejectFn) => {
    pendingResolve = resolve;
    pendingReject = rejectFn;

    // Set timeout
    pendingTimeout = setTimeout(() => {
      reject(new Error("Sign-in timed out. Please try again."));
    }, TIMEOUT_MS);

    chrome.tabs.create({ url: OAUTH_START_URL }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        reject(new Error("Failed to open sign-in tab."));
        return;
      }
      pendingTabId = tab.id;

      // Watch for user closing the tab before completing OAuth
      chrome.tabs.onRemoved.addListener(function onRemoved(removedTabId) {
        if (removedTabId !== pendingTabId) return;
        chrome.tabs.onRemoved.removeListener(onRemoved);
        if (pendingReject) {
          const rej = pendingReject;
          cleanup();
          rej(new Error("Sign-in cancelled."));
        }
      });
    });
  });
}
