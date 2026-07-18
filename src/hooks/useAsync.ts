import { useEffect, useRef, useState, type DependencyList } from "react";

interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
}

/**
 * Run an async function whenever deps change; ignores stale results when
 * deps change mid-flight. `enabled: false` skips the fetch (e.g. logged out).
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: DependencyList,
  enabled = true,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    error: undefined,
    loading: enabled,
  });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setState({ data: undefined, error: undefined, loading: false });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fnRef.current().then(
      (data) => {
        if (alive) setState({ data, error: undefined, loading: false });
      },
      (err: unknown) => {
        if (alive)
          setState({
            data: undefined,
            error: err instanceof Error ? err.message : "Something went wrong",
            loading: false,
          });
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
