# Iroh Nansen chat handoff

## Purpose

Add a Host-panel research chat that calls Nansen Research Agent from the server and streams responses into the room.

## Completed

- Server route uses `NANSEN_API_KEY`, validates requests, handles Nansen streaming/SSE events, and returns safe errors.
- Client supports streaming, stop, retry, and starting a new conversation. Nansen `conversation_id` continues follow-ups during the current in-memory session.
- Guests and authenticated users can open Iroh. The route/session has no chat persistence.

## Remaining work

- **Persistent chat history is NOT implemented yet.** Future work should add:
  - chats linked to authenticated `user.id`;
  - `Chat` and `Message` persistence;
  - saved Nansen `conversation_id` per chat;
  - a chat history UI;
  - reopening and continuing old chats.
- Browser messages and the current Nansen conversation ID are lost on reload. Add ownership checks when persistence is introduced.
- Run a manual live-key check against Nansen; automated route and stream tests use a simulated upstream. Safari and Firefox have not been separately verified.

## Important files / architecture

- `src/app/api/nansen-agent/route.ts`: server boundary and request validation.
- `src/nansen/session.ts`, `src/nansen/sse.ts`: Nansen request lifecycle and stream parsing.
- `src/ui/IrohChat.tsx`, `src/ui/IrohMessage.tsx`, `src/ui/TeaRoomShell.tsx`: client state and Host panel.
- `tests/nansen-route.test.ts`, `nansen-session.test.ts`, `nansen-sse.test.ts`, `tests/browser/iroh*.spec.ts`: service and browser coverage.
- `NANSEN_API_KEY` is configured server-side; do not expose it to the browser.

## Validation performed

On `feature/iroh-nansen-chat`: `npm run typecheck`, `npm test` (9 files, 59 tests), and `npm run build` all passed on 25 September 2026. Project status also records prior Chromium journey verification; a live-key check remains manual.

## Recommended next steps

1. Implement persistent chat records and API with authenticated-user ownership.
2. Store each chat's Nansen `conversation_id`, then add history, reopen, and continue flows.
3. Verify streaming with a live Nansen key and test ownership/isolation in browser flows.
