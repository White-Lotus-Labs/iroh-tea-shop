import type { PrismaClient } from '@prisma/client';
import { contextualQuestion } from '../nansen/context';

export class ChatNotFoundError extends Error {
  constructor() {
    super('Chat not found');
  }
}

export async function createChat(db: PrismaClient, userId: string) {
  return db.chat.create({ data: { userId } });
}

export async function listChats(db: PrismaClient, userId: string) {
  return db.chat.findMany({
    where: { userId },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getChat(
  db: PrismaClient,
  userId: string,
  chatId: string,
) {
  return db.chat.findFirst({
    where: { id: chatId, userId },
    include: { messages: { orderBy: { id: 'asc' } } },
  });
}

async function ownedChat(db: PrismaClient, userId: string, chatId: string) {
  const chat = await db.chat.findFirst({ where: { id: chatId, userId } });
  if (!chat) throw new ChatNotFoundError();
  return chat;
}

export async function appendUserMessage(
  db: PrismaClient,
  userId: string,
  chatId: string,
  content: string,
) {
  const chat = await ownedChat(db, userId, chatId);
  const message = await db.message.create({
    data: { chatId, role: 'user', content },
  });
  await db.chat.update({
    where: { id: chatId, userId },
    data: {
      ...(chat.title === 'New chat'
        ? { title: content.replace(/\s+/g, ' ').trim().slice(0, 70) }
        : {}),
    },
  });
  return message;
}

export async function appendAssistantMessage(
  db: PrismaClient,
  userId: string,
  chatId: string,
  content: string,
  status: 'complete' | 'stopped' = 'complete',
) {
  await ownedChat(db, userId, chatId);
  const message = await db.message.create({
    data: { chatId, role: 'assistant', content, status },
  });
  await db.chat.update({ where: { id: chatId, userId }, data: {} });
  return message;
}

export async function setConversationId(
  db: PrismaClient,
  userId: string,
  chatId: string,
  conversationId: string | null,
) {
  await ownedChat(db, userId, chatId);
  return db.chat.update({
    where: { id: chatId, userId },
    data: { nansenConversationId: conversationId },
  });
}

export async function prepareResearchRequest(
  db: PrismaClient,
  userId: string,
  chatId: string,
  question: string,
) {
  const chat = await getChat(db, userId, chatId);
  if (!chat) throw new ChatNotFoundError();
  const text = chat.nansenConversationId
    ? question
    : contextualQuestion(question, chat.messages);
  await appendUserMessage(db, userId, chatId, question);
  return { text, conversationId: chat.nansenConversationId };
}
