# Iroh Nansen chat handoff

The Host panel provides live Nansen Research Agent chat. Signed-in users have persistent chats in the existing local Prisma SQLite database. Guests keep an in-memory conversation.

## Storage and authorization

- `Chat` belongs to `User` and stores title, timestamps and `nansenConversationId`.
- `Message` belongs to `Chat` and stores role, content, status and timestamp. Its autoincrementing ID preserves transcript order.
- Run `npm run db:migrate` after pulling this change. The SQLite file is local and ignored by Git.
- `/api/iroh/chats` lists and creates only the current session user's chats. `/api/iroh/chats/[chatId]` restores only an owned chat. `/api/nansen-agent` resolves ownership before contacting Nansen and ignores browser-supplied conversation IDs for signed-in chats.

## Conversation behavior

- New Chat creates a database row with no Nansen ID. Reopening a chat restores its messages and saved ID.
- The research route saves each user question, streams Nansen deltas, then saves the assistant answer and any returned ID before closing the response. The client waits for stream closure before treating the answer as saved.
- When Nansen returns a null ID, recent completed exchanges from the saved chat are included in the next research request to resolve follow-up references. This is bounded by Nansen's 6,000-character question limit.
- Stop and retry remain available. Stopped partial answers are saved when the server receives them. Guests retain the earlier memory-only behavior.

## Main files

- `prisma/schema.prisma`, `prisma/migrations/20260926080000_iroh_chat_history/`: schema and migration.
- `src/iroh/`: ownership-aware data access and session request parsing.
- `src/app/api/iroh/chats/`, `src/app/api/nansen-agent/route.ts`: history and research HTTP endpoints.
- `src/nansen/`: conversation context, SSE parsing, client streaming lifecycle.
- `src/ui/IrohChat.tsx`, `src/app/globals.css`: Host history interface.

Automated tests use simulated Nansen streams and do not consume live Nansen credits. A live-key check, Safari and Firefox verification are still manual.
