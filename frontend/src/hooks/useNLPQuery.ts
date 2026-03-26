import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface QueryResult {
  type: 'chart' | 'table' | 'summary' | 'comparison' | 'anomaly' | 'prediction';
  title: string;
  summary: string;
  data: unknown;
  chartConfig?: {
    chartType: 'line' | 'bar' | 'pie' | 'area' | 'radar';
    xAxis?: string;
    yAxis?: string;
    series?: string[];
  };
  followUpSuggestions: string[];
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  starred: boolean;
  result?: QueryResult;
}

export interface NLPSuggestion {
  text: string;
  category: 'performance' | 'comparison' | 'anomaly' | 'trend' | 'employee' | 'general';
  icon: string;
}

interface UseNLPQueryReturn {
  query: (text: string) => Promise<void>;
  getSuggestions: (partial: string) => Promise<NLPSuggestion[]>;
  history: QueryHistoryItem[];
  loading: boolean;
  currentResult: QueryResult | null;
  error: string | null;
  clearHistory: () => void;
  toggleStar: (id: string) => void;
  reRunQuery: (queryText: string) => Promise<void>;
}

const STORAGE_KEY = 'pulse_nlp_query_history';
const MAX_HISTORY = 50;

export function useNLPQuery(): UseNLPQueryReturn {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryHistoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  }, [history]);

  const query = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setCurrentResult(null);

    try {
      const response = await fetch('/api/method/pulse.api.nlp.process_query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_text: text,
          context: {
            user: (window as unknown as { frappe?: { session?: { user?: string } } }).frappe?.session?.user || 'Guest',
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();

      if (data.message?.success) {
        const result = data.message.result as QueryResult;
        setCurrentResult(result);

        const newItem: QueryHistoryItem = {
          id: `query-${Date.now()}`,
          query: text,
          timestamp: new Date().toISOString(),
          starred: false,
          result,
        };

        setHistory(prev => {
          const filtered = prev.filter(item => item.query !== text);
          return [newItem, ...filtered].slice(0, MAX_HISTORY);
        });

        toast.success(result.summary);
      } else {
        const errorMsg = data.message?.error || 'Failed to process query';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getSuggestions = useCallback(async (partial: string): Promise<NLPSuggestion[]> => {
    if (!partial.trim() || partial.length < 2) return [];

    try {
      const response = await fetch(`/api/method/pulse.api.nlp.get_suggestions?partial_query=${encodeURIComponent(partial)}`);
      const data = await response.json();
      return data.message?.suggestions || [];
    } catch {
      return getFallbackSuggestions(partial);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    toast.success('All query history has been removed');
  }, [toast]);

  const toggleStar = useCallback((id: string) => {
    setHistory(prev => prev.map(item => item.id === id ? { ...item, starred: !item.starred } : item));
  }, []);

  const reRunQuery = useCallback(async (queryText: string): Promise<void> => {
    await query(queryText);
  }, [query]);

  return {
    query,
    getSuggestions,
    history,
    loading,
    currentResult,
    error,
    clearHistory,
    toggleStar,
    reRunQuery,
  };
}

function getFallbackSuggestions(partial: string): NLPSuggestion[] {
  const allSuggestions: NLPSuggestion[] = [
    { text: 'Show me underperforming branches', category: 'performance', icon: 'trending-down' },
    { text: 'Compare Q1 vs Q2 scores', category: 'comparison', icon: 'git-compare' },
    { text: 'Find employees with low completion rates', category: 'performance', icon: 'users' },
    { text: 'What are the top performing departments?', category: 'performance', icon: 'trophy' },
    { text: 'Show score trends for last 30 days', category: 'trend', icon: 'line-chart' },
    { text: 'Identify anomalies in SOP compliance', category: 'anomaly', icon: 'alert-triangle' },
    { text: 'Predict next month performance', category: 'trend', icon: 'trending-up' },
    { text: 'List all operators in North Region', category: 'employee', icon: 'list' },
    { text: 'Show corrective actions by priority', category: 'general', icon: 'flag' },
    { text: 'Which templates have the lowest completion?', category: 'performance', icon: 'file-text' },
  ];

  const lower = partial.toLowerCase();
  return allSuggestions.filter(s => s.text.toLowerCase().includes(lower)).slice(0, 5);
}
