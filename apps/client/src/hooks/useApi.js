import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with { data, meta, loading, error, reload, setData }.
 * `deps` re-run the request (e.g. page or query changes). Stale responses from
 * an older request are ignored, so fast typing never shows the wrong results.
 */
export function useApi(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: enabled, error: null });
  const callId = useRef(0);

  const run = useCallback(async () => {
    if (!enabled) return;
    callId.current += 1;
    const id = callId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, meta } = await fetcher();
      if (id === callId.current) setState({ data, meta: meta ?? null, loading: false, error: null });
    } catch (error) {
      if (id === callId.current) setState((s) => ({ ...s, loading: false, error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    run();
  }, [run]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
