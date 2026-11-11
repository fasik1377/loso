"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Flag, Loader2, Send } from "lucide-react";
import { reportAction, sendMessageAction } from "@/lib/actions/member";
import { cx } from "@/components/ui/primitives";

interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  hidden: boolean;
}

const POLL_MS = 4000;
const URL_RE = /(https?:\/\/[^\s<]+)/g;

/** Renders text with http(s) links made clickable. Everything else stays plain escaped text. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow ugc" className="underline">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ChatWindow({ conversationId, currentUserId, initial }: { conversationId: string; currentUserId: string; initial: ChatMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef(initial.at(-1)?.createdAt);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !ids.has(m.id))];
      lastRef.current = next.at(-1)?.createdAt;
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (document.hidden) return;
      const q = lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : "";
      const res = await fetch(`/api/conversations/${conversationId}/messages${q}`, { cache: "no-store" }).catch(() => null);
      if (!alive || !res?.ok) return;
      const data = (await res.json()) as { messages: (Omit<ChatMessage, "hidden"> & { hiddenAt: string | null })[] };
      merge(data.messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt, hidden: !!m.hiddenAt })));
    };
    const t = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [conversationId, merge]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      try {
        const m = await sendMessageAction(conversationId, body);
        merge([{ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt, hidden: false }]);
        setDraft("");
      } catch {
        setError("Message not sent. Please try again.");
      }
    });
  };

  const report = async (messageId: string) => {
    if (!confirm("Report this message to Looso moderators?")) return;
    const fd = new FormData();
    fd.set("targetType", "MESSAGE");
    fd.set("targetId", messageId);
    fd.set("reason", "ABUSE");
    const res = await reportAction(null, fd);
    alert(res.ok ? "Thanks. Moderators will review this message." : res.error);
  };

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-label="Messages">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello!</p>}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={cx("group flex", mine ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[80%] rounded-2xl px-4 py-2 text-sm", mine ? "bg-brand text-on-brand" : "bg-canvas text-ink", m.hidden && "italic opacity-70")}>
                <p className="whitespace-pre-wrap break-words">{m.hidden ? m.body : <Linkified text={m.body} />}</p>
                <p className={cx("mt-1 text-[10px]", mine ? "text-on-brand/70" : "text-muted")}>
                  {new Date(m.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              {!mine && !m.hidden && (
                <button type="button" onClick={() => report(m.id)} className="ml-1 self-center rounded p-1 text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100" aria-label="Report message">
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <textarea
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Write a message…"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <button type="submit" disabled={pending || !draft.trim()} className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-on-brand disabled:opacity-50" aria-label="Send">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      {error && <p role="alert" className="px-3 pb-2 text-xs text-danger">{error}</p>}
    </>
  );
}
