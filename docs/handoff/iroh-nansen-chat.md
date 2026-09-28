# Iroh Nansen chat handoff

> Historical note from an earlier pass. Uncle chat is still a live Nansen call. The rest of the market numbers are saved in SQLite. For how the app works today, read the [README](../../README.md) and [How the tea shop works](../project-status.md).

## Completed

- The Host panel streams live Nansen Research Agent responses with stop, retry and New Chat controls. Signed-in users can show or hide Chat history, open an old chat and continue it after a page reload. Guests can still chat without signing in.
- Signed-in chats and messages persist in the existing local Prisma SQLite database. Each chat belongs to the authenticated `user.id`, has a title and timestamps, and stores its Nansen `conversation_id` as `nansenConversationId`.
- The research route checks chat ownership before contacting Nansen. It saves user questions and streamed assistant answers, then saves the returned conversation ID before closing the response. A new chat starts with no Nansen ID; a reopened chat continues with its saved ID.
- If Nansen returns a null ID, follow-ups include up to four recent completed exchanges from that chat within the 6,000-character request limit. A later null ID clears an earlier saved ID.

## Remaining work

- Run a manual live-key check against Nansen. Automated route and browser tests use simulated Nansen streams and do not spend live credits.
- Verify Safari and Firefox separately; automated browser coverage currently uses Chromium.
- Chats made before persistence was added lived only in browser memory and cannot be recovered from the database. Guest chats remain in memory by design.

## Architecture

- `src/ui/IrohChat.tsx` owns the Host history control and selection UI. `src/nansen/session.ts` manages browser streaming, stop/retry and restoration of the selected chat.
- `/api/iroh/chats` creates and lists the signed-in user's chats. `/api/iroh/chats/[chatId]` returns an owned chat and ordered messages.
- `/api/nansen-agent` validates requests, resolves the session for saved chats, loads the chat's server-held Nansen ID, streams safe SSE events and persists the result. The house key (`NANSEN_API_KEY`) stays on the server. Visitors may also send their own key in `x-user-nansen-api-key` for Uncle only; see the [README](../../README.md) and [How the tea shop works](../project-status.md).
- `src/iroh/history.ts` applies ownership checks for reads and writes. `src/nansen/context.ts` builds bounded follow-up context when Nansen supplies no conversation ID. The guest path remains memory-only.

## Database usage

- `prisma/schema.prisma` defines `User → Chat → Message`; the new schema is applied by `prisma/migrations/20260926080000_iroh_chat_history/migration.sql`.
- `Chat` stores `id`, `userId`, `title`, nullable `nansenConversationId`, `createdAt` and `updatedAt`. `Message` stores an ordered ID, `chatId`, role, content, status and `createdAt`. Foreign keys cascade on deletion.
- The ignored `prisma/dev.db` file is local to each checkout. Run `npm run db:migrate` after pulling these changes into another checkout or deployment. No separate database is introduced.

## Validation

- `npx prisma validate`, `npm run typecheck` and `npm run build` pass. `npm test` passes 72 tests across 11 files.
- Unit and route tests cover creation, message storage, reload restoration, account isolation, Nansen ID reuse, fresh-chat IDs, null-ID fallback, SSE streaming and stop/retry. Chromium browser tests cover Host history visibility, switching chats, reload, guest access and account flows.
- The targeted Chromium run passed all 9 tests in `auth.spec.ts`, `iroh-guest.spec.ts` and `iroh.spec.ts`.

## Recommended next steps

1. Apply the migration wherever PR #3 is checked out or deployed.
2. Perform one manual end-to-end question and follow-up with a configured Nansen key to verify the provider's current conversation-ID behavior.
3. Check the Host panel in Safari and Firefox before release.
