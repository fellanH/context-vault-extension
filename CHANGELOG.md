# Changelog

## [2.9.0]

- Add `ErrorCode` enum (`not_configured`, `unauthorized`, `rate_limited`, `server_error`, `network_error`, `timeout`) to shared types
- Add `ConnectionStatus` discriminated union replacing two boolean state variables in the popup
- Introduce `APIError` class with typed `status` and `code` fields — eliminates all `as any` casts on error objects
- Add in-memory rate limit cache with pre-flight check: exhausted limits are rejected immediately without a network request
- Propagate `count` from search API through the message chain; `ResultList` shows "(N total)" when the server has more matches than the page limit
- Export `sortByDomOrder` from `platforms/types.ts` and remove duplicate implementations in `claude.ts` and `gemini.ts`

## [2.8.9]

- Add `team_id` field to `Entry` type (returned by all API responses)
- Add `VaultStatus` interface matching full `/api/vault/status` schema
- Add `folder` param to `createEntry` (mirrors MCP `save_context`)
- Add `ingestUrl()` API client function calling `POST /api/vault/ingest`
- Add "Ingest Page into Context Vault" right-click context menu item

## [2.8.8]

- Fix placeholder URLs: `app.context-vault.com` → `api.context-vault.com` in Settings and onboarding
- Replace broken setup guide link with sign-up link and `npx context-vault connect` hint
- Enable CI auto-publish on version tags with GitHub Release creation
