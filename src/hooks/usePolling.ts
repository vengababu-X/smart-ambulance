import { useCallback, useEffect, useRef, useState } from "react";

type FetchFunction<T> = () => Promise<T>;

interface PollingState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export default function usePolling<T>(
  fetchFunction: FetchFunction<T>,
  intervalMs = 5000
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);

    try {
      const nextData = await fetchFunction();

      if (mountedRef.current) {
        setData(nextData);
        setError(null);
      }
    } catch (caughtError) {
      if (mountedRef.current) {
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Polling request failed.")
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFunction]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();

    const interval = window.setInterval(() => {
      void refetch();
    }, Math.max(intervalMs, 1000));

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [intervalMs, refetch]);

  return { data, loading, error, refetch };
}
