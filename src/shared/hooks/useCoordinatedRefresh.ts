import { useCallback, useEffect, useRef, useState } from "react";

export type CoordinatedRefreshPhase =
  | "initialLoading"
  | "backgroundRefreshing"
  | "settled"
  | "degraded"
  | "blocked"
  | "error";

export type CoordinatedRefreshReason =
  | "initial"
  | "auth"
  | "filter"
  | "manual"
  | "mutation"
  | "poll"
  | "resume";

type QueuedOperation = {
  kind: "refresh" | "task";
  run: () => Promise<void>;
  waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }>;
};

type CoordinatedRefreshOptions<T> = {
  resourceKey: string;
  load: () => Promise<T>;
  initialData: T;
  pollIntervalMs: number;
  pollEnabled: boolean | ((data: T) => boolean);
  classify?: (data: T) => Exclude<CoordinatedRefreshPhase, "initialLoading" | "backgroundRefreshing" | "error">;
  isEqual?: (left: T, right: T) => boolean;
};

function defaultEquality<T>(left: T, right: T) {
  return Object.is(left, right);
}

export function structurallyEqual<T>(left: T, right: T) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function useCoordinatedRefresh<T>({
  resourceKey,
  load,
  initialData,
  pollIntervalMs,
  pollEnabled,
  classify = () => "settled",
  isEqual = defaultEquality,
}: CoordinatedRefreshOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [phase, setPhase] = useState<CoordinatedRefreshPhase>("initialLoading");
  const dataRef = useRef(data);
  const loadRef = useRef(load);
  const classifyRef = useRef(classify);
  const equalityRef = useRef(isEqual);
  const initialDataRef = useRef(initialData);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const settledRef = useRef(false);
  const activeRef = useRef(false);
  const activeKindRef = useRef<QueuedOperation["kind"] | null>(null);
  const queueRef = useRef<QueuedOperation[]>([]);

  loadRef.current = load;
  classifyRef.current = classify;
  equalityRef.current = isEqual;
  initialDataRef.current = initialData;
  const pollingActive = typeof pollEnabled === "function" ? pollEnabled(data) : pollEnabled;

  const commit = useCallback((next: T | ((current: T) => T)) => {
    if (!mountedRef.current) return;
    const resolved = typeof next === "function"
      ? (next as (current: T) => T)(dataRef.current)
      : next;
    if (equalityRef.current(dataRef.current, resolved)) return;
    dataRef.current = resolved;
    setData(resolved);
  }, []);

  const pump = useCallback(function pumpNext() {
    if (!mountedRef.current || activeRef.current) return;
    const operation = queueRef.current.shift();
    if (!operation) return;
    activeRef.current = true;
    activeKindRef.current = operation.kind;
    void operation.run().then(
      () => operation.waiters.forEach(({ resolve }) => resolve()),
      (error) => operation.waiters.forEach(({ reject }) => reject(error)),
    ).finally(() => {
      activeRef.current = false;
      activeKindRef.current = null;
      pumpNext();
    });
  }, []);

  const enqueue = useCallback((operation: Omit<QueuedOperation, "waiters">) => new Promise<void>((resolve, reject) => {
    if (!mountedRef.current) { resolve(); return; }
    if (operation.kind === "refresh") {
      const queuedRefresh = queueRef.current.find((queued) => queued.kind === "refresh");
      if (queuedRefresh) {
        queuedRefresh.waiters.push({ resolve, reject });
        return;
      }
    }
    queueRef.current.push({ ...operation, waiters: [{ resolve, reject }] });
    pump();
  }), [pump]);

  const refresh = useCallback((reason: CoordinatedRefreshReason = "manual") => enqueue({
    kind: "refresh",
    run: async () => {
      const generation = generationRef.current;
      if (mountedRef.current) {
        setPhase(settledRef.current ? "backgroundRefreshing" : "initialLoading");
      }
      try {
        const next = await loadRef.current();
        if (!mountedRef.current || generation !== generationRef.current) return;
        commit(next);
        settledRef.current = true;
        setPhase(classifyRef.current(next));
      } catch (error) {
        if (mountedRef.current && generation === generationRef.current) {
          settledRef.current = true;
          setPhase("error");
        }
        if (import.meta.env.DEV) console.warn(`[Refresh controller] ${reason}`, error);
      }
    },
  }), [commit, enqueue]);

  const runExclusive = useCallback((task: () => Promise<void>) => enqueue({
    kind: "task",
    run: async () => {
      if (mountedRef.current && settledRef.current) setPhase("backgroundRefreshing");
      try {
        await task();
        if (mountedRef.current) setPhase(classifyRef.current(dataRef.current));
      } catch (error) {
        if (mountedRef.current) setPhase("error");
        throw error;
      }
    },
  }), [enqueue]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const operation of queueRef.current.splice(0)) {
        operation.waiters.forEach(({ resolve }) => resolve());
      }
    };
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    settledRef.current = false;
    dataRef.current = initialDataRef.current;
    setData(initialDataRef.current);
    setPhase("initialLoading");
    void refresh("filter");
  }, [refresh, resourceKey]);

  useEffect(() => {
    if (!pollingActive || pollIntervalMs <= 0) return;
    let timer: number | null = null;
    let lastResumeAt = 0;

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      clearTimer();
      if (document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        timer = null;
        if (document.visibilityState !== "visible") return;
        void refresh("poll").finally(schedule);
      }, pollIntervalMs);
    };
    const resume = () => {
      if (document.visibilityState !== "visible") { clearTimer(); return; }
      const now = Date.now();
      if (now - lastResumeAt < 750) return;
      lastResumeAt = now;
      clearTimer();
      void refresh("resume").finally(schedule);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") resume();
      else clearTimer();
    };

    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule();
    return () => {
      clearTimer();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pollingActive, pollIntervalMs, refresh]);

  return {
    data,
    phase,
    initialLoading: phase === "initialLoading",
    backgroundRefreshing: phase === "backgroundRefreshing",
    busy: phase === "initialLoading" || phase === "backgroundRefreshing" || activeRef.current || activeKindRef.current !== null,
    refresh,
    runExclusive,
    updateData: commit,
  };
}
