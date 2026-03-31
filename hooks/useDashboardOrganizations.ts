"use client";

import { useEffect, useState } from "react";
import type { Organization } from "@/types/finance";

export function useDashboardOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard", { method: "GET" });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as { organizations: Organization[] };
        if (!cancelled) setOrganizations(data.organizations);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load organizations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { organizations, loading, error };
}

