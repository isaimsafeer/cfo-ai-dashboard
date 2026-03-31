"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useDashboardOrganizations } from "@/hooks/useDashboardOrganizations";
import { useAiChat } from "@/hooks/useAiChat";
import { useSearchParams } from "next/navigation";
import type { AiChatQueryParams } from "@/types/navigation";

function formatMessageRole(role: string) {
  return role === "user" ? "You" : "AI CFO";
}

// ─── Inner component that uses useSearchParams ────────────────────────────────
// Must be wrapped in <Suspense> because useSearchParams() opts into
// dynamic rendering and Next.js requires a boundary during prerendering.
function AiChatInner() {
  const { organizations, loading: orgsLoading, error: orgsError } = useDashboardOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { messages, send, loading, error, setMessages } = useAiChat(selectedOrgId);
  const [input, setInput] = useState("");
  const searchParams = useSearchParams();
  const navParams: AiChatQueryParams = useMemo(
    () => ({
      orgId: searchParams.get("orgId") ?? undefined,
    }),
    [searchParams],
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedOrgId) return;

    const desired = navParams.orgId;
    if (desired && organizations.some((o) => o.id === desired)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedOrgId(desired);
      return;
    }

    if (organizations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedOrgId(organizations[0].id);
    }
  }, [navParams.orgId, organizations, selectedOrgId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    await send(text);
  }

  return (
    <div className="min-h-screen w-full bg-[#07090c] text-zinc-100 font-sans">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.14),_transparent_55%),radial-gradient(ellipse_at_right,_rgba(59,130,246,0.12),_transparent_48%),radial-gradient(ellipse_at_left,_rgba(168,85,247,0.10),_transparent_42%)]" />

        <div className="relative mx-auto w-full max-w-3xl px-6 pt-10 pb-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                <span className="bg-gradient-to-r from-cyan-300 via-emerald-300 to-indigo-300 bg-clip-text text-transparent">
                  AI CFO Chat
                </span>
              </h1>
              <div className="mt-2 text-sm text-zinc-400">
                Audit-friendly answers powered by Supabase-backed tools.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  Verified finance data
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  Tool-audited responses
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Organization</label>
              <div className="relative">
                <select
                  aria-label="Organization"
                  className="w-full appearance-none rounded-full border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-zinc-100 backdrop-blur outline-none transition-colors focus:border-white/20 focus:bg-white/10 focus:ring-1 focus:ring-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                  value={selectedOrgId ?? ""}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  disabled={orgsLoading}
                >
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M7 10l5 5 5-5"
                      stroke="rgba(255,255,255,0.72)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
          </div>

          {orgsError ? (
            <div className="mt-6 text-sm text-rose-400" role="alert">
              {orgsError}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 shadow-sm backdrop-blur overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-zinc-100">Conversation</div>
                <div className="mt-1 text-xs text-zinc-400">
                  Ask anything about revenue, expenses, margin, and anomalies.
                </div>
              </div>
              {messages.length > 0 ? (
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200 transition hover:bg-white/10 hover:border-white/15"
                  onClick={() => setMessages([])}
                >
                  Clear chat
                </button>
              ) : null}
            </div>

            <div className="flex flex-col">
              <div className="max-h-[55vh] flex-1 overflow-y-auto px-5 py-6">
                {messages.length === 0 ? (
                  <div className="text-sm text-zinc-400">
                    Try: <span className="font-medium text-zinc-200">"What is our burn rate?"</span>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {messages.map((m, idx) => (
                    <div
                      key={`${m.role}-${idx}`}
                      className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                    >
                      <div
                        className={[
                          "group max-w-[85%] rounded-2xl border px-4 py-3 transition-transform",
                          m.role === "user"
                            ? "border-cyan-400/20 bg-gradient-to-br from-cyan-500/18 to-emerald-500/10 hover:-translate-y-0.5"
                            : "border-white/10 bg-zinc-950/35 hover:-translate-y-0.5",
                        ].join(" ")}
                      >
                        <div className="text-xs font-semibold text-zinc-300">
                          {formatMessageRole(m.role)}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-100/95">
                          {m.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div ref={bottomRef} />
              </div>

              <div className="border-t border-white/10 px-5 py-4">
                <form onSubmit={onSubmit} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-white/20 focus:bg-white/10 focus:ring-1 focus:ring-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask the AI CFO…"
                    disabled={!selectedOrgId || loading}
                  />

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-50 transition hover:bg-white/15 border border-white/10 disabled:opacity-50 disabled:hover:bg-white/10"
                    disabled={!canSend}
                    aria-label="Send message"
                  >
                    {loading ? "Sending…" : "Send"}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M22 2L11 13"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M22 2L15 22L11 13L2 9L22 2Z"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </form>

                {error ? (
                  <div className="mt-3 text-sm text-rose-400" role="alert">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loading skeleton shown while AiChatInner resolves searchParams ───────────
function AiChatSkeleton() {
  return (
    <div className="min-h-screen w-full bg-[#07090c] text-zinc-100 font-sans flex items-center justify-center">
      <div className="text-sm text-zinc-500 animate-pulse">Loading…</div>
    </div>
  );
}

// ─── Default export wraps the inner component in the required Suspense boundary
export default function AiChatClient() {
  return (
    <Suspense fallback={<AiChatSkeleton />}>
      <AiChatInner />
    </Suspense>
  );
}