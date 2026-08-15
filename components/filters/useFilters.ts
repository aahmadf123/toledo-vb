"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseFilters, serializeFilters, type Filters } from "@/lib/filters";

/**
 * URL-synced filter state: initialized from the query string, written back
 * with history.replaceState so every change is instant (no navigation, no
 * refetch) and every view stays shareable. Pages using this must render
 * inside <Suspense> (useSearchParams requirement).
 */
export function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => parseFilters(searchParams));

  const update = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      const params = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(serializeFilters(next))) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
      return next;
    });
  }, []);

  return [filters, update];
}
