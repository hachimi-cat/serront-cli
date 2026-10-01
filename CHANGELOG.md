# Changelog

## 0.3.0
- `serront api webhook-subscriptions deliveries` (`--subscription-id`, `--status`, `--type`, `--limit`, `--cursor`), `get-deliveries <id>`, `deliveries-retry <id>` and `event-types`: the webhook delivery log, with every attempt, and a retry.
- `serront api webhook-subscriptions update <id>` takes `--url` and `--events` too (it only took `--active`).

## 0.2.0
- A route read by id next to its list is named `get` + the list's name: `serront api client get-orders` (was `serront api client orders-2`), `serront api fulfillment get-deliveries` (was `serront api fulfillment deliveries-2`), `serront api fulfillment get-shipments` (was `serront api fulfillment shipments-2`), `serront api public get-storefront-blog` (was `serront api public storefront-blog-2`). Each old name still works, hidden from help.
- Query fields the API refuses a request without are now required: `key` on GET /api/v1/fulfillment/licenses/validate.

## 0.1.3
- `serront auth login` now signs in for real: the Huudis device flow (prints a code, opens the browser, saves the session to `~/.serront/session.json` and refreshes it when it expires), or `--api-key <key>` (`-` reads stdin) to save an `sk_live_…` API key for machines and CI.
- `serront auth whoami` shows the Huudis user or which key is in use, plus the workspace the API resolves it to (`GET /api/v1/me`); `serront auth logout` deletes the saved credentials. All three take `--json`.
- `SERRONT_TOKEN` still wins over the saved sign-in.

## 0.1.1
- Package metadata now points at the public mirror repo (github.com/hachimi-cat/serront-cli).
