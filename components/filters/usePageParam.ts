"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * A single page-specific URL param (tab, session, set …) with the same
 * replaceState sync semantics as useFilters: default values drop out of the
 * URL, every state is shareable.
 */
export function usePageParam(
  key: string,
  defaultValue: string
): [string, (value: string) => void] {
  const searchParams = useSearchParams();
  const [value, setValue] = useState(() => searchParams.get(key) ?? defaultValue);

  const set = useCallback(
    (next: string) => {
      setValue(next);
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue) params.delete(key);
      else params.set(key, next);
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    },
    [key, defaultValue]
  );

  return [value, set];
}
