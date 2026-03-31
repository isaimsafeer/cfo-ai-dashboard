"use client";

import { useCallback, useMemo, useState } from "react";
import type { AiChatMessage } from "@/types/ai";

export function useAiChat(orgId: string | null | undefined) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stableOrgId = useMemo(() => orgId ?? null, [orgId]);

  const send = useCallback(
    async (message: string) => {
      setLoading(true);
      setError(null);

      const userMsg: AiChatMessage = { role: "user", content: message };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const history = messages;
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            messages: history.length ? history : undefined,
            orgId: stableOrgId ?? undefined,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `AI request failed (${res.status})`);
        }

        const json = (await res.json()) as { text: string };
        const assistantMsg: AiChatMessage = { role: "assistant", content: json.text };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send message");
      } finally {
        setLoading(false);
      }
    },
    [messages, stableOrgId],
  );

  return { messages, send, loading, error, setMessages };
}

