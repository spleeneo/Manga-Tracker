import * as Ably from "ably";

export const CHAT_HISTORY_LIMIT = 100;
export const CHAT_MAX_BODY_LENGTH = 1000;
export const CHAT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const CHAT_ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const CHAT_CHANNEL = "chat:global";
export const CHAT_TYPING_CHANNEL = "chat:global:typing";

export interface ChatUserPayload {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface ChatMessagePayload {
  id: string;
  body: string | null;
  imageUrl: string | null;
  imageName: string | null;
  imageMime: string | null;
  imageSize: number | null;
  createdAt: string;
  user: ChatUserPayload;
}

interface ChatMessageRecord {
  id: string;
  body: string | null;
  imageUrl: string | null;
  imageName: string | null;
  imageMime: string | null;
  imageSize: number | null;
  createdAt: Date;
  user: ChatUserPayload;
}

export function serializeChatMessage(message: ChatMessageRecord): ChatMessagePayload {
  return {
    id: message.id,
    body: message.body,
    imageUrl: message.imageUrl,
    imageName: message.imageName,
    imageMime: message.imageMime,
    imageSize: message.imageSize,
    createdAt: message.createdAt.toISOString(),
    user: message.user,
  };
}

export function normalizeChatBody(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidChatImageUrl(value: unknown) {
  return typeof value === "string" && /^https:\/\/.+/i.test(value);
}

export function getAblyRestClient() {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) return null;
  return new Ably.Rest(apiKey);
}

export async function publishChatMessage(message: ChatMessagePayload) {
  const client = getAblyRestClient();
  if (!client) return false;
  await client.channels.get(CHAT_CHANNEL).publish("message", message);
  return true;
}

export async function createChatTokenRequest(userId: string) {
  const client = getAblyRestClient();
  if (!client) return null;
  return client.auth.createTokenRequest({
    clientId: userId,
    capability: JSON.stringify({
      [CHAT_CHANNEL]: ["subscribe"],
      [CHAT_TYPING_CHANNEL]: ["publish", "subscribe"],
    }),
  });
}
