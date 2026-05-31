import { useState, useCallback } from 'react';

export interface PrecioOverrideHook {
  overrides:    Map<string, number>;
  set:          (key: string, val: number) => void;
  remove:       (key: string) => void;
  clear:        () => void;
  get:          (key: string) => number | undefined;
  hasOverride:  (key: string) => boolean;
}

export function usePrecioOverride(): PrecioOverrideHook {
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());

  const set = useCallback((key: string, val: number) => {
    setOverrides(prev => new Map(prev).set(key, val));
  }, []);

  const remove = useCallback((key: string) => {
    setOverrides(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clear = useCallback(() => setOverrides(new Map()), []);

  const get = useCallback((key: string) => overrides.get(key), [overrides]);

  const hasOverride = useCallback((key: string) => overrides.has(key), [overrides]);

  return { overrides, set, remove, clear, get, hasOverride };
}
