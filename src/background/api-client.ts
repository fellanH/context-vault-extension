/**
 * api-client.ts — REST API client for the background service worker.
 *
 * All API calls go through the service worker to avoid CORS issues.
 * Mirrors the pattern from packages/app/src/app/lib/api.ts.
 */

import { ErrorCode } from "@/shared/types";
import type {
  Entry,
  SearchResult,
  ExtensionSettings,
  VaultStatus,
  UserProfile,
} from "@/shared/types";

// Intentionally volatile — resets when the service worker is terminated.
// On restart, getSettings() falls back to chrome.storage.local automatically.
let cachedSettings: ExtensionSettings | null = null;

async function getSettings(): Promise<ExtensionSettings> {
  if (cachedSettings) return cachedSettings;
  const result = await chrome.storage.local.get([
    "serverUrl",
    "apiKey",
    "encryptionSecret",
  ]);
  cachedSettings = {
    serverUrl: result.serverUrl || "",
    apiKey: result.apiKey || "",
    encryptionSecret: result.encryptionSecret || "",
  };
  return cachedSettings;
}

/** Clear settings cache (call after settings change) */
export function clearSettingsCache(): void {
  cachedSettings = null;
}

export class APIError extends Error {
  readonly status: number;
  readonly code?: ErrorCode;
  constructor(message: string, status: number, code?: ErrorCode) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
  }
}

interface RateLimitState {
  remaining: number;
  resetAt: number;
}
let cachedRateLimit: RateLimitState | null = null;

function updateRateLimitCache(
  remaining: string | null,
  reset: string | null,
): void {
  if (remaining === null && reset === null) return;
  const r =
    remaining !== null
      ? Number(remaining)
      : (cachedRateLimit?.remaining ?? Infinity);
  const t = reset !== null ? Number(reset) : (cachedRateLimit?.resetAt ?? 0);
  if (Number.isFinite(r) && Number.isFinite(t))
    cachedRateLimit = { remaining: r, resetAt: t };
  const toStore: Record<string, string> = {};
  if (remaining !== null) toStore.rateLimitRemaining = remaining;
  if (reset !== null) toStore.rateLimitReset = reset;
  if (Object.keys(toStore).length > 0) chrome.storage.local.set(toStore);
}

export function clearRateLimitCache(): void {
  cachedRateLimit = null;
}

const RETRY_BACKOFF_MS = [1000, 3000];
const FETCH_TIMEOUT_MS = 15_000;
const NO_RETRY_STATUSES = new Set([401, 429]);

function statusToErrorCode(status: number): ErrorCode | undefined {
  if (status === 401) return ErrorCode.UNAUTHORIZED;
  if (status === 429) return ErrorCode.RATE_LIMITED;
  if (status >= 500) return ErrorCode.SERVER_ERROR;
  return undefined;
}

/** Detect network-level connection failures and rewrite to actionable messages */
function friendlyError(err: unknown): APIError | Error {
  if (err instanceof APIError) return err; // pass through typed errors unchanged

  const msg = err instanceof Error ? err.message : String(err);

  // Browser fetch throws TypeError on network-level failures (refused, DNS, etc.)
  const isNetworkError =
    (err instanceof TypeError && /fetch|network/i.test(msg)) ||
    msg === "Failed to fetch" ||
    /ECONNREFUSED|ECONNRESET|ENOTFOUND/i.test(msg);

  if (isNetworkError)
    return new APIError(
      "Could not reach the server. Check your connection and server URL.",
      0,
      ErrorCode.NETWORK_ERROR,
    );
  if (/timed out/i.test(msg)) return new APIError(msg, 0, ErrorCode.TIMEOUT);
  if (/not configured/i.test(msg))
    return new APIError(msg, 0, ErrorCode.NOT_CONFIGURED);
  return err instanceof Error ? err : new Error(msg);
}

/** Quick connectivity probe — resolves true if the server responds within timeout */
export async function probeServer(timeoutMs = 3000): Promise<boolean> {
  const { serverUrl } = await getSettings();
  if (!serverUrl) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(
      `${serverUrl.replace(/\/$/, "")}/api/vault/status`,
      {
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { serverUrl, apiKey } = await getSettings();

  if (!serverUrl)
    throw new APIError(
      "Not configured — set server URL in extension settings",
      0,
      ErrorCode.NOT_CONFIGURED,
    );
  if (!apiKey)
    throw new APIError(
      "Not configured — set API key in extension settings",
      0,
      ErrorCode.NOT_CONFIGURED,
    );

  if (
    cachedRateLimit !== null &&
    cachedRateLimit.remaining <= 0 &&
    Date.now() / 1000 < cachedRateLimit.resetAt
  ) {
    const resetTime = new Date(
      cachedRateLimit.resetAt * 1000,
    ).toLocaleTimeString();
    throw new APIError(
      `Rate limit exhausted. Resets at ${resetTime}.`,
      429,
      ErrorCode.RATE_LIMITED,
    );
  }

  const url = `${serverUrl.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Only include auth header when apiKey is set
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  // Include encryption secret for split-authority decryption
  const { encryptionSecret } = await getSettings();
  if (encryptionSecret) {
    headers["X-Vault-Secret"] = encryptionSecret;
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        const err = new APIError(
          body.error || `API error: ${res.status}`,
          res.status,
          statusToErrorCode(res.status),
        );

        // Don't retry auth errors or rate limits
        if (NO_RETRY_STATUSES.has(res.status)) throw err;

        lastError = err;
        if (attempt < RETRY_BACKOFF_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
          continue;
        }
        throw err;
      }

      // Store rate limit headers for UI consumption
      updateRateLimitCache(
        res.headers.get("X-RateLimit-Remaining"),
        res.headers.get("X-RateLimit-Reset"),
      );

      return res.json();
    } catch (err) {
      // AbortError means timeout — eligible for retry
      if (err instanceof DOMException && err.name === "AbortError") {
        lastError = new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms`);
        if (attempt < RETRY_BACKOFF_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
          continue;
        }
      }

      // Non-retryable errors (including 401/429 rethrown above)
      if (err instanceof APIError && NO_RETRY_STATUSES.has(err.status))
        throw err;

      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < RETRY_BACKOFF_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
        continue;
      }
    }
  }

  throw friendlyError(lastError) || new Error("apiFetch failed after retries");
}

/** Search the vault with hybrid semantic + full-text search */
export async function searchVault(
  query: string,
  opts: { kind?: string; category?: string; limit?: number } = {},
): Promise<{ results: SearchResult[]; count: number; query: string }> {
  return apiFetch("/api/vault/search", {
    method: "POST",
    body: JSON.stringify({ query, ...opts }),
  });
}

/** Create a new vault entry */
export async function createEntry(data: {
  kind: string;
  body: string;
  title?: string;
  tags?: string[];
  source?: string;
  identity_key?: string;
  folder?: string;
}): Promise<Entry> {
  return apiFetch("/api/vault/entries", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      source: data.source || "browser-extension",
    }),
  });
}

/** Fetch a URL and save it as a vault entry */
export async function ingestUrl(
  url: string,
  opts: { kind?: string; tags?: string[] } = {},
): Promise<Entry> {
  return apiFetch("/api/vault/ingest", {
    method: "POST",
    body: JSON.stringify({ url, ...opts }),
  });
}

/** Get vault status (doubles as connection test) */
export async function getVaultStatus(): Promise<VaultStatus> {
  return apiFetch("/api/vault/status");
}

/**
 * Fetch the authenticated user's profile from GET /api/auth/me.
 * Called with explicit credentials right after OAuth so we don't depend on cache.
 * Returns null on any error so the extension still connects.
 */
export async function getUserProfile(
  serverUrl: string,
  apiKey: string,
): Promise<UserProfile | null> {
  try {
    const url = `${serverUrl.replace(/\/$/, "")}/api/auth/me`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
