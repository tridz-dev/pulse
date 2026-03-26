import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { frappe } from '@/lib/frappe-sdk';
import { call } from '@/lib/frappe-sdk';

export type RealtimeChannel = 'pulse:metrics' | 'pulse:runs' | 'pulse:scores' | 'pulse:anomalies' | 'pulse:activity';
export type RealtimeEventType = 'run_completed' | 'run_updated' | 'score_updated' | 'significant_score_drop' | 'anomaly_detected' | 'activity' | 'item_failed' | 'corrective_action_created';

export interface RealtimeEvent {
  type: RealtimeEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface LiveMetrics {
  activeRuns: number;
  completedToday: number;
  avgScoreToday: number;
  activeUsers: number;
  pendingItems: number;
  lastUpdated: string;
}

export interface UseRealtimeReturn {
  isConnected: boolean;
  lastEvent: RealtimeEvent | null;
  error: Error | null;
  reconnect: () => void;
}

const realtimeKeys = {
  all: ['pulse', 'realtime'] as const,
  liveMetrics: () => [...realtimeKeys.all, 'liveMetrics'] as const,
  activity: (limit: number) => [...realtimeKeys.all, 'activity', limit] as const,
};

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

export function useRealtime(
  channel: RealtimeChannel,
  callback?: (event: RealtimeEvent) => void,
  options: { enabled?: boolean; onError?: (error: Error) => void } = {}
): UseRealtimeReturn {
  const { enabled = true, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubscribedRef = useRef(false);

  const socket = useMemo(() => {
    try {
      return (frappe as { socket?: { socket?: unknown } }).socket?.socket;
    } catch {
      return null;
    }
  }, []);

  const subscribe = useCallback(() => {
    if (!socket || !enabled || isSubscribedRef.current) return;
    try {
      (socket as { emit: (event: string, data: string) => void }).emit('doctype_subscribe', channel);
      isSubscribedRef.current = true;
      setIsConnected(true);
      setError(null);
      reconnectAttemptRef.current = 0;
      (socket as { on: (event: string, callback: (data: RealtimeEvent) => void) => void }).on(channel, (event: RealtimeEvent) => {
        setLastEvent(event);
        callback?.(event);
      });
      (socket as { on: (event: string, callback: () => void) => void }).on('disconnect', () => {
        setIsConnected(false);
        isSubscribedRef.current = false;
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to subscribe');
      setError(error);
      onError?.(error);
      setIsConnected(false);
    }
  }, [socket, channel, callback, enabled, onError]);

  const unsubscribe = useCallback(() => {
    if (!socket || !isSubscribedRef.current) return;
    try {
      (socket as { emit: (event: string, data: string) => void }).emit('doctype_unsubscribe', channel);
      (socket as { off: (event: string) => void }).off(channel);
      isSubscribedRef.current = false;
      setIsConnected(false);
    } catch (err) {
      console.error('Error unsubscribing:', err);
    }
  }, [socket, channel]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
    reconnectAttemptRef.current += 1;
    reconnectTimeoutRef.current = setTimeout(() => {
      unsubscribe();
      subscribe();
    }, delay);
  }, [subscribe, unsubscribe]);

  useEffect(() => {
    if (!enabled) {
      unsubscribe();
      return;
    }
    if (socket) subscribe();
    return () => {
      unsubscribe();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [enabled, socket, subscribe, unsubscribe]);

  useEffect(() => {
    if (error && enabled && socket) reconnect();
  }, [error, enabled, socket, reconnect]);

  return { isConnected, lastEvent, error, reconnect };
}

export function useLiveMetrics() {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { data: metrics, isLoading, isError, error, refetch } = useQuery({
    queryKey: realtimeKeys.liveMetrics(),
    queryFn: async (): Promise<LiveMetrics> => {
      const res = await call.get('pulse.api.realtime.get_live_dashboard_data');
      const data = res.message as { active_runs: number; completed_today: number; avg_score_today: number; active_users: number; pending_items: number; last_updated: string };
      return {
        activeRuns: data.active_runs || 0,
        completedToday: data.completed_today || 0,
        avgScoreToday: data.avg_score_today || 0,
        activeUsers: data.active_users || 0,
        pendingItems: data.pending_items || 0,
        lastUpdated: data.last_updated,
      };
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  useRealtime('pulse:metrics', (event) => {
    if (event.type === 'run_completed' || event.type === 'score_updated') {
      queryClient.invalidateQueries({ queryKey: realtimeKeys.liveMetrics() });
      setLastUpdate(new Date());
    }
  });

  useEffect(() => { if (metrics) setLastUpdate(new Date()); }, [metrics]);

  const refresh = useCallback(async () => { await refetch(); }, [refetch]);

  const defaultMetrics: LiveMetrics = { activeRuns: 0, completedToday: 0, avgScoreToday: 0, activeUsers: 0, pendingItems: 0, lastUpdated: new Date().toISOString() };

  return { metrics: metrics || defaultMetrics, isLoading, isError, error: error as Error | null, lastUpdate, refresh };
}

interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export function useActivityStream(limit = 20) {
  const queryClient = useQueryClient();
  const [hasNewActivity, setHasNewActivity] = useState(false);

  const { data: activities, isLoading, isError, error, refetch } = useQuery({
    queryKey: realtimeKeys.activity(limit),
    queryFn: async (): Promise<ActivityEvent[]> => {
      const res = await call.get('pulse.api.realtime.get_recent_activity', { limit });
      return res.message as ActivityEvent[];
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  useRealtime('pulse:activity', () => {
    setHasNewActivity(true);
    setTimeout(() => { queryClient.invalidateQueries({ queryKey: realtimeKeys.all }); }, 1000);
  });

  const dismissNewActivity = useCallback(() => { setHasNewActivity(false); }, []);

  return { activities: activities || [], isLoading, isError, error: error as Error | null, hasNewActivity, dismissNewActivity, refresh: refetch };
}

export default useRealtime;
