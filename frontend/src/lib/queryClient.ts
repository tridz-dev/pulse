import { QueryClient } from '@tanstack/react-query';

/** Shared TanStack Query client: browser-side cache + dedupe; pairs with server Redis on heavy APIs. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

export const pulseQueryKeys = {
  all: ['pulse'] as const,
  demoStatus: ['pulse', 'demoStatus'] as const,
  myRuns: (date: string) => ['pulse', 'myRuns', date] as const,
  dashboardScore: (userId: string, date: string, period: string) =>
    ['pulse', 'dashboard', 'score', userId, date, period] as const,
  dashboardTeam: (userId: string, date: string, period: string) =>
    ['pulse', 'dashboard', 'team', userId, date, period] as const,
  dashboardAnalytics: (userId: string, date: string) =>
    ['pulse', 'dashboard', 'analytics', userId, date] as const,
  insightsBundle: (payload: string) => ['pulse', 'insights', payload] as const,
  goHomeSummary: ['pulse', 'goHomeSummary'] as const,
  assignments: {
    all: ['pulse', 'assignments'] as const,
    list: () => ['pulse', 'assignments', 'list'] as const,
    detail: (id: string) => ['pulse', 'assignments', 'detail', id] as const,
    options: () => ['pulse', 'assignments', 'options'] as const,
    calendar: (start: string, end: string) => ['pulse', 'assignments', 'calendar', start, end] as const,
  },
  branches: {
    all: ['pulse', 'branches'] as const,
    list: () => ['pulse', 'branches', 'list'] as const,
    detail: (id: string) => ['pulse', 'branches', 'detail', id] as const,
    options: () => ['pulse', 'branches', 'options'] as const,
  },
  employees: {
    all: ['pulse', 'employees'] as const,
    list: () => ['pulse', 'employees', 'list'] as const,
    detail: (id: string) => ['pulse', 'employees', 'detail', id] as const,
    options: () => ['pulse', 'employees', 'options'] as const,
    hierarchy: () => ['pulse', 'employees', 'hierarchy'] as const,
  },
  departments: {
    all: ['pulse', 'departments'] as const,
    list: () => ['pulse', 'departments', 'list'] as const,
  },
  analytics: {
    all: ['pulse', 'analytics'] as const,
    anomalies: () => ['pulse', 'analytics', 'anomalies'] as const,
    predictions: (days: number) => ['pulse', 'analytics', 'predictions', days] as const,
    recommendations: () => ['pulse', 'analytics', 'recommendations'] as const,
    compliance: (range: string) => ['pulse', 'analytics', 'compliance', range] as const,
    trends: () => ['pulse', 'analytics', 'trends'] as const,
  },
};
