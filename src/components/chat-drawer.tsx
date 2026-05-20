"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, MessageCircle, Send, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import type { ChatMessagePayload } from "@/lib/chat";

interface CurrentChatUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface UploadedImage {
  imageUrl: string;
  imageName: string;
  imageMime: string;
  imageSize: number;
}

interface PendingImage {
  file: File;
  previewUrl: string;
}

type DisplayMessage = ChatMessagePayload & { pending?: boolean };

function userLabel(user: ChatMessagePayload["user"] | CurrentChatUser) {
  return user.name || user.email || "Someone";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function typingLabel(names: string[]) {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing...`;
  return `${names.length} people are typing...`;
}

export function ChatDrawer({ currentUser }: { currentUser: CurrentChatUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [body, setBody] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; expiresAt: number }>>(new Map());
  const { showToast } = useToast();
  const listRef = useRef<HTMLDivElement | null>(null);
  const ablyRef = useRef<{
    close: () => void;
    messageChannel: { unsubscribe: () => void };
    typingChannel: { unsubscribe: () => void; publish: (name: string, data: unknown) => Promise<unknown> };
  } | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const scrollToLatest = (behavior: ScrollBehavior = "smooth") => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior });
    });
  };

  const activeTypingNames = useMemo(() => {
    return Array.from(typingUsers.entries())
      .filter(([userId]) => userId !== currentUser.id)
      .map(([, state]) => state.name);
  }, [currentUser.id, typingUsers]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/chat/messages")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Chat load failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setMessages(data.messages ?? []);
        scrollToLatest("auto");
      })
      .catch((error) => {
        console.error(error);
        showToast({
          type: "error",
          title: "Chat did not load",
          description: "Please try again.",
        });
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, showToast]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function connect() {
      try {
        const Ably = await import("ably");
        if (cancelled) return;
        const client = new Ably.Realtime({ authUrl: "/api/chat/ably-token" });
        const messageChannel = client.channels.get("chat:global");
        const typingChannel = client.channels.get("chat:global:typing");

        await messageChannel.subscribe("message", (event) => {
          const incoming = event.data as ChatMessagePayload;
          setMessages((current) => {
            if (current.some((message) => message.id === incoming.id)) return current;
            return [...current.filter((message) => !message.pending), incoming].slice(-100);
          });
        });

        await typingChannel.subscribe("typing", (event) => {
          const data = event.data as { userId?: string; name?: string; isTyping?: boolean };
          if (!data.userId || data.userId === currentUser.id) return;
          const typingUserId = data.userId;
          setTypingUsers((current) => {
            const next = new Map(current);
            if (data.isTyping) {
              next.set(typingUserId, {
                name: data.name || "Someone",
                expiresAt: Date.now() + 3500,
              });
            } else {
              next.delete(typingUserId);
            }
            return next;
          });
        });

        ablyRef.current = {
          close: () => client.close(),
          messageChannel,
          typingChannel,
        };
      } catch (error) {
        console.error(error);
        showToast({
          type: "error",
          title: "Realtime chat is not connected",
          description: "Messages can still load, but live updates need Ably setup.",
        });
      }
    }

    void connect();

    return () => {
      cancelled = true;
      ablyRef.current?.messageChannel.unsubscribe();
      ablyRef.current?.typingChannel.unsubscribe();
      ablyRef.current?.close();
      ablyRef.current = null;
    };
  }, [currentUser.id, isOpen, showToast]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTypingUsers((current) => {
        const now = Date.now();
        const next = new Map(Array.from(current.entries()).filter(([, state]) => state.expiresAt > now));
        return next.size === current.size ? current : next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    scrollToLatest(messages.length > 0 ? "smooth" : "auto");
  }, [messages, isOpen]);

  const publishTyping = (isTyping: boolean) => {
    void ablyRef.current?.typingChannel.publish("typing", {
      userId: currentUser.id,
      name: userLabel(currentUser),
      isTyping,
    });
  };

  const openChat = () => {
    setIsLoading(true);
    setIsOpen(true);
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    publishTyping(value.trim().length > 0);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => publishTyping(false), 1800);
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast({ type: "error", title: "Only images can be attached" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast({ type: "error", title: "Image is too large", description: "Keep chat images under 5 MB." });
      return;
    }
    setPendingImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  };

  const clearPendingImage = () => {
    setPendingImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  };

  const uploadImage = async (image: PendingImage | null): Promise<UploadedImage | null> => {
    if (!image) return null;
    const formData = new FormData();
    formData.set("file", image.file);
    const res = await fetch("/api/chat/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image upload failed");
    return data as UploadedImage;
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedBody = body.trim();
    if (!trimmedBody && !pendingImage) return;

    setIsSending(true);
    const selectedImage = pendingImage;
    const pendingId = `pending-${Date.now()}`;
    const optimisticImage = selectedImage?.previewUrl ?? null;
    const optimisticMessage: DisplayMessage = {
      id: pendingId,
      body: trimmedBody || null,
      imageUrl: optimisticImage,
      imageName: selectedImage?.file.name ?? null,
      imageMime: selectedImage?.file.type ?? null,
      imageSize: selectedImage?.file.size ?? null,
      createdAt: new Date().toISOString(),
      pending: true,
      user: {
        id: currentUser.id,
        name: currentUser.name ?? null,
        email: currentUser.email ?? null,
        image: currentUser.image ?? null,
      },
    };

    setMessages((current) => [...current, optimisticMessage].slice(-100));
    setBody("");
    setPendingImage(null);
    publishTyping(false);

    try {
      const image = await uploadImage(selectedImage);
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmedBody,
          ...(image ?? {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Message was not sent");
      setMessages((current) => current.map((message) => message.id === pendingId ? data.message : message));
      if (selectedImage?.previewUrl) URL.revokeObjectURL(selectedImage.previewUrl);
    } catch (error) {
      console.error(error);
      setMessages((current) => current.filter((message) => message.id !== pendingId));
      if (selectedImage?.previewUrl) URL.revokeObjectURL(selectedImage.previewUrl);
      showToast({
        type: "error",
        title: "Message was not sent",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openChat}
        className="ui-icon-button"
        aria-label="Open global chat"
        title="Open global chat"
      >
        <MessageCircle className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close chat"
            className="chat-overlay absolute inset-0 bg-black/55"
            onClick={() => setIsOpen(false)}
          />
          <aside className="chat-panel absolute inset-y-0 right-0 flex w-full flex-col border-l border-border shadow-2xl sm:w-[420px]">
            <header className="flex h-16 items-center justify-between border-b border-border px-4">
              <div>
                <h2 className="text-lg font-bold">Global chat</h2>
                <p className="text-xs text-muted-foreground">Signed-in Mangateo users</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="ui-icon-button"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={listRef} className="chat-message-list custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading chat
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  <MessageCircle className="mb-3 h-8 w-8 opacity-50" />
                  No messages yet.
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.user.id === currentUser.id;
                  return (
                    <article key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg border border-border p-3 text-sm shadow-sm ${isMine ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"}`}>
                        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase opacity-75">
                          <span>{isMine ? "You" : userLabel(message.user)}</span>
                          <span>{formatTime(message.createdAt)}</span>
                          {message.pending ? <span>Sending</span> : null}
                        </div>
                        {message.body ? <p className="whitespace-pre-wrap leading-5">{message.body}</p> : null}
                        {message.imageUrl ? (
                          <a href={message.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block overflow-hidden rounded-md border border-border bg-background">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={message.imageUrl} alt={message.imageName ?? "Chat image"} className="max-h-64 w-full object-cover" />
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="min-h-6 border-t border-border px-4 py-1 text-xs text-muted-foreground">
              {typingLabel(activeTypingNames)}
            </div>

            <form onSubmit={sendMessage} className="border-t border-border p-3">
              {pendingImage ? (
                <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-card p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pendingImage.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{pendingImage.file.name}</p>
                    <p className="text-xs text-muted-foreground">{Math.ceil(pendingImage.file.size / 1024)} KB</p>
                  </div>
                  <button
                    type="button"
                    className="ui-icon-button h-8 w-8"
                    aria-label="Remove attached image"
                    onClick={clearPendingImage}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <label className="ui-icon-button shrink-0 cursor-pointer" title="Attach image" aria-label="Attach image">
                  <ImagePlus className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                  />
                </label>
                <textarea
                  value={body}
                  onChange={(event) => handleBodyChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={1000}
                  placeholder="Message everyone..."
                  className="ui-field min-h-10 max-h-32 resize-none py-2"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={isSending || (!body.trim() && !pendingImage)}
                  className="ui-button ui-button-primary h-10 w-10 shrink-0 px-0"
                  aria-label="Send message"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
