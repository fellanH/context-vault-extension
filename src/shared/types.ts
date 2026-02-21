/** Vault entry as returned by the REST API */
export interface Entry {
  id: string;
  kind: string;
  category: "knowledge" | "entity" | "event";
  title: string | null;
  body: string | null;
  tags: string[];
  meta: Record<string, unknown>;
  source: string | null;
  identity_key: string | null;
  expires_at: string | null;
  created_at: string;
  team_id: string | null;
}

export interface SearchResult extends Entry {
  score: number;
}

/** Response shape from GET /api/vault/status */
export interface VaultStatus {
  health: "ok" | "degraded";
  entries: {
    total: number;
    by_kind: Record<string, number>;
    by_category: Record<string, number>;
  };
  database: {
    size: string;
    size_bytes: number;
    stale_paths: number;
    expired: number;
  };
  embeddings: {
    indexed: number;
    total: number;
    missing: number;
  } | null;
  embed_model_available: boolean | null;
  errors: string[];
}

/** A single chat message extracted from an AI conversation */
export interface ChatMessage {
  index: number;
  role: "user" | "assistant";
  content: string;
  platform: string;
}

/** Messages between popup/content scripts and background service worker */
export type MessageType =
  | { type: "search"; query: string; limit?: number }
  | { type: "search_result"; results: SearchResult[]; query: string }
  | { type: "inject_text"; text: string }
  | { type: "inject_result"; success: boolean }
  | { type: "get_messages" }
  | { type: "messages_result"; messages: ChatMessage[]; platform: string }
  | {
      type: "capture";
      kind: string;
      body: string;
      title?: string;
      tags?: string[];
      source?: string;
    }
  | { type: "capture_result"; id: string }
  | { type: "get_settings" }
  | {
      type: "settings";
      serverUrl: string;
      apiKey: string;
      connected: boolean;
      encryptionSecret?: string;
    }
  | {
      type: "save_settings";
      serverUrl: string;
      apiKey: string;
      encryptionSecret?: string;
    }
  | { type: "test_connection" }
  | {
      type: "connection_result";
      success: boolean;
      error?: string;
      code?: string;
    }
  | { type: "check_health" }
  | { type: "health_result"; reachable: boolean }
  | { type: "error"; message: string };

/** Extension storage shape */
export interface ExtensionSettings {
  serverUrl: string;
  apiKey: string;
  encryptionSecret?: string;
}

/** Default settings */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  serverUrl: "https://api.context-vault.com",
  apiKey: "",
};
