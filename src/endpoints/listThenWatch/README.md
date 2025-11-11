# List-Then-Watch WebSocket — README

This endpoint exposes a **Kubernetes “list → then watch”** stream over WebSocket.
Clients receive an **INITIAL** snapshot of resources (optionally paginated) and then continuous **watch events** (`ADDED`, `MODIFIED`, `DELETED`, plus `BOOKMARK` for RV advancement). The server is resilient to **410 Gone** (expired `resourceVersion`) and periodically **rotates** the watch to avoid stale connections.

---

## What this service does (high level)

1. **Parse query params** to know _what_ to list/watch (group, version, plural, namespace) and _how_ to filter (label/field selectors), plus pagination and resume-from-RV options.
2. **List** the current items from the Kubernetes API (sorted newest-first).
3. Send an **INITIAL** message with the items and pagination token.
4. Start a **Watch** from the most recent `resourceVersion` (RV), forwarding each event to the client.
5. If the watch fails with **410 Gone** (RV expired), **re-list** to refresh RV and **restart** the watch.
6. **Heartbeat** pings the client; if it doesn’t pong, the socket is terminated.
7. Every **10 minutes**, rotate the watch proactively.

---

## Endpoint shape

- **Type:** WebSocket (Express + `express-ws`)
- **Handler:** `listWatchWebSocket(ws, req)`
- **Kubernetes client:** `@kubernetes/client-node` `Watch` + shared Axios (`userKubeApi`) for list calls
- **Auth/headers:** forwarded via `filterHeadersFromEnv(req)` (except in `DEVELOPMENT`)

---

## Query parameters

| Param                      | Required | Example                | Purpose                                                |
| -------------------------- | -------- | ---------------------- | ------------------------------------------------------ |
| `apiVersion`               | ✅       | `v1`                   | API version (e.g., `v1`, `apps/v1`)                    |
| `plural`                   | ✅       | `pods`                 | Resource plural                                        |
| `apiGroup`                 | ❌       | `apps`                 | API group; omit/empty for core                         |
| `namespace`                | ❌       | `default`              | Namespace scoping                                      |
| `limit`                    | ❌       | `50`                   | Page size for initial list / subsequent pages          |
| `_continue`                | ❌       | token                  | Continue token for initial list                        |
| `fieldSelector` / `field`  | ❌       | `metadata.name=my-pod` | Field selector; multiple values are joined with commas |
| `labelSelector` / `labels` | ❌       | `app=web,env=prod`     | Label selector; multiple values are joined with commas |
| `sinceRV`                  | ❌       | `1234567`              | Resume watch starting from this RV (client-provided)   |

> Multiple `labelSelector` (or `fieldSelector`) params are joined with commas. Values are safely decoded (handles double-encoding).

---

## Message protocol

### Server → Client

- **INITIAL**

  ```json
  {
    "type": "INITIAL",
    "items": [
      /* list page items, newest-first */
    ],
    "continue": "token or undefined",
    "remainingItemCount": 123,
    "resourceVersion": "rv-string"
  }
  ```

- **PAGE** (in response to client SCROLL)

  ```json
  {
    "type": "PAGE",
    "items": [
      /* next page */
    ],
    "continue": "next-token or undefined",
    "remainingItemCount": 42
  }
  ```

- **ADDED | MODIFIED | DELETED**

  ```json
  {
    "type": "ADDED",
    "item": {
      /* k8s object */
    }
  }
  ```

- **SERVER_LOG** (best-effort diagnostics)

  ```json
  { "type": "SERVER_LOG", "level": "info|warn|error", "message": "..." }
  ```

> `BOOKMARK` events are **not** forwarded; they’re used internally to update `lastRV`.

### Client → Server

- **SCROLL** (get next page using the `_continue` token from `INITIAL`/`PAGE`)

  ```json
  { "type": "SCROLL", "continue": "<token>", "limit": 50 }
  ```

On SCROLL failure, server sends:

```json
{ "type": "PAGE_ERROR", "error": "Failed to load next page" }
```

---

## Ordering and consistency

- **List sorting:** newest-first by `creationTimestamp`, then by `resourceVersion` (desc).
- **Watch RV:** `lastRV` is captured from list `metadata.resourceVersion`, then advanced on each event and on `BOOKMARK`.
- **Consistency window:** When listing **without** a `continue`, if `lastRV` exists the server uses:

  - `resourceVersion = lastRV`
  - `resourceVersionMatch = 'NotOlderThan'`

  This aims to avoid serving items _older than_ the client’s known state.

---

## Resilience & lifecycle

- **410 Gone / Expired RV:** server re-lists to refresh RV, then restarts the watch.
- **Watch rotation:** every **10 minutes**, the server restarts the watch (helps with stuck proxies/TCP).
- **Heartbeat:** server `ping` every \*\*25s`; if no `pong` before next tick, the socket is terminated.
- **Cleanup:** on `close`/`error`, timers are cleared and the active watch is aborted.

---

## Security & headers

- **Headers** forwarded only if allowed by environment via `filterHeadersFromEnv`.
  In `DEVELOPMENT`, no forwarding (use local config).
- **Kubernetes client** is created **per connection** with `createUserKubeClient(headers)`.

> Ensure your reverse proxy and cluster RBAC permit the requested List/Watch verbs for the target resources.

---

## Typical flows

**Cold start**

1. Client connects → server parses params.
2. Server `LIST`s page 1 → sends **INITIAL** (with `_continue` if present).
3. Server starts **WATCH** at `resourceVersion` from the list.
4. Client may `SCROLL` for more pages; meanwhile, watch events stream in.

**Expired RV (410)**

1. Watch error `410 Gone` → server re-lists (`captureRV: true`).
2. Server restarts watch from the new RV.

**Network hiccup**

1. Heartbeat misses `pong` → server terminates socket.
2. Client reconnects, optionally passing `sinceRV` to resume.

---

## Troubleshooting

- **Got closed quickly with code 1008** → Missing required params `apiVersion` and/or `plural`.
- **No events arriving** → Check label/field selectors, RBAC for `watch`, and network/proxy idle timeouts.
- **Periodic disconnects** → Expected due to watch rotation; client should reconnect automatically.
- **PAGE_ERROR** on SCROLL → Continue token may have expired; re-request from the latest `_continue` or refresh.

---

## Configuration knobs (in code)

- **Ping interval:** `25_000` ms
- **Watch rotation:** `10 * 60 * 1000` ms
- **Restart backoff on watch error:** `~1.2–2.0s`
- **Headers forwarding:** controlled by `DEVELOPMENT` and `filterHeadersFromEnv`

---

## Notes & limitations

- This endpoint **does not** buffer or replay events after disconnect; use `sinceRV` on reconnect for best-effort resumption.
- `resourceVersionMatch = 'NotOlderThan'` is used only for the _list_ when `_continue` is not present; not all apiservers support `resourceVersionMatch` on **watch**, so it’s omitted there.
- Sorting is client-friendly (newest-first) but **not** a server-side guarantee; it’s applied to the list page items only.

---

## Glossary

- **RV (resourceVersion):** Monotonic token indicating etcd state; used to watch from or to ensure consistent reads.
- **BOOKMARK:** Lightweight watch event with only `metadata.resourceVersion`; used to advance RV without sending objects.
- **\_continue:** Server-issued token to fetch the **next page** of a list operation.
