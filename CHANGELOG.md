# Changelog

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
