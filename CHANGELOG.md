# Changelog

## 0.1.3
- `serront auth login` now signs in for real: the Huudis device flow (prints a code, opens the browser, saves the session to `~/.serront/session.json` and refreshes it when it expires), or `--api-key <key>` (`-` reads stdin) to save an `sk_live_…` API key for machines and CI.
- `serront auth whoami` shows the Huudis user or which key is in use, plus the workspace the API resolves it to (`GET /api/v1/me`); `serront auth logout` deletes the saved credentials. All three take `--json`.
- `SERRONT_TOKEN` still wins over the saved sign-in.

## 0.1.1
- Package metadata now points at the public mirror repo (github.com/hachimi-cat/serront-cli).
