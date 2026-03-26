/**
 * Offline Detection and Management Hook
 * Provides online/offline status, sync queue management, and cached data access
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncManager, type QueuedAction } from './syncManager';

export interface OfflineData {
  sopRuns: unknown[];
  templates: unknown[];
  userProfile: unknown | null;
  lastSyncTime: number | null;
}

export interface UseOfflineReturn {
  // Status
  isOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  
  // Actions
  syncWhenOnline: (action: QueuedAction) => Promise<string>;
  retrySync: () => Promise<void>;
  getOfflineData: () => Promise<OfflineData>;
  clearPendingActions: () => void;
  
  // Data
  offlineData: OfflineData;
}

/**
 * Hook for managing offline state and queued actions
 */
export function useOffline(): UseOfflineReturn {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [offlineData, setOfflineData] = useState<OfflineData>({
    sopRuns: [],
    templates: [],
    userProfile: null,
    lastSyncTime: null
  });
  
  const mountedRef = useRef(true);

  // Update pending count
  const updatePendingCount = useCallback(() => {
    if (mountedRef.current) {
      setPendingCount(syncManager.getPendingCount());
    }
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Auto-retry sync when coming back online
      setTimeout(() => retrySync(), 1000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    // Listen for sync completion
    const handleSyncCompleted = (event: CustomEvent) => {
      setIsSyncing(false);
      setLastSyncTime(Date.now());
      updatePendingCount();
      
      // Refresh offline data after successful sync
      if (!mountedRef.current) return;
      
      const results = event.detail || [];
      const failedCount = results.filter((r: { success: boolean }) => !r.success).length;
      
      if (failedCount > 0) {
        console.warn(`[Offline] ${failedCount} actions failed to sync`);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-completed', handleSyncCompleted as EventListener);

    // Initial check
    setIsOffline(!navigator.onLine);
    updatePendingCount();
    loadCachedData();

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-completed', handleSyncCompleted as EventListener);
    };
  }, [updatePendingCount]);

  // Load cached data from IndexedDB
  const loadCachedData = async () => {
    try {
      const data = await getOfflineDataInternal();
      if (mountedRef.current) {
        setOfflineData(data);
        if (data.lastSyncTime) {
          setLastSyncTime(data.lastSyncTime);
        }
      }
    } catch (error) {
      console.error('[Offline] Failed to load cached data:', error);
    }
  };

  /**
   * Queue an action to be synced when online
   */
  const syncWhenOnline = useCallback(async (action: QueuedAction): Promise<string> => {
    const actionId = await syncManager.queueAction(action);
    updatePendingCount();
    
    // If we're online, try to process immediately
    if (navigator.onLine) {
      setIsSyncing(true);
      syncManager.processQueue().finally(() => {
        if (mountedRef.current) {
          setIsSyncing(false);
          updatePendingCount();
        }
      });
    }
    
    return actionId;
  }, [updatePendingCount]);

  /**
   * Manually retry pending syncs
   */
  const retrySync = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) {
      console.log('[Offline] Cannot sync while offline');
      return;
    }

    const pending = syncManager.getPendingCount();
    if (pending === 0) {
      return;
    }

    setIsSyncing(true);
    
    try {
      await syncManager.processQueue();
      setLastSyncTime(Date.now());
    } catch (error) {
      console.error('[Offline] Sync failed:', error);
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
        updatePendingCount();
      }
    }
  }, [updatePendingCount]);

  /**
   * Get cached offline data
   */
  const getOfflineData = useCallback(async (): Promise<OfflineData> => {
    return getOfflineDataInternal();
  }, []);

  /**
   * Clear all pending actions
   */
  const clearPendingActions = useCallback((): void => {
    syncManager.clearQueue();
    updatePendingCount();
  }, [updatePendingCount]);

  return {
    isOffline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncWhenOnline,
    retrySync,
    getOfflineData,
    clearPendingActions,
    offlineData
  };
}

/**
 * Helper to retrieve offline data from IndexedDB
 */
async function getOfflineDataInternal(): Promise<OfflineData> {
  return new Promise((resolve) => {
    const DB_NAME = 'pulse-offline-data';
    const DB_VERSION = 1;
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      resolve({
        sopRuns: [],
        templates: [],
        userProfile: null,
        lastSyncTime: null
      });
    };
    
    request.onsuccess = () => {
      const db = request.result;
      
      // Check if store exists
      if (!db.objectStoreNames.contains('data')) {
        resolve({
          sopRuns: [],
          templates: [],
          userProfile: null,
          lastSyncTime: null
        });
        return;
      }
      
      const transaction = db.transaction(['data'], 'readonly');
      const store = transaction.objectStore('data');
      
      const sopRunsReq = store.get('sopRuns');
      const templatesReq = store.get('templates');
      const userProfileReq = store.get('userProfile');
      const lastSyncReq = store.get('lastSyncTime');
      
      Promise.all([
        new Promise(r => { sopRunsReq.onsuccess = () => r(sopRunsReq.result?.value || []); }),
        new Promise(r => { templatesReq.onsuccess = () => r(templatesReq.result?.value || []); }),
        new Promise(r => { userProfileReq.onsuccess = () => r(userProfileReq.result?.value || null); }),
        new Promise(r => { lastSyncReq.onsuccess = () => r(lastSyncReq.result?.value || null); })
      ]).then(([sopRuns, templates, userProfile, lastSyncTime]) => {
        resolve({
          sopRuns: sopRuns as unknown[],
          templates: templates as unknown[],
          userProfile: userProfile as unknown | null,
          lastSyncTime: lastSyncTime as number | null
        });
      }).catch(() => {
        resolve({
          sopRuns: [],
          templates: [],
          userProfile: null,
          lastSyncTime: null
        });
      });
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Hook for caching specific data for offline use
 */
export function useOfflineCache<T>(key: string, fetcher: () => Promise<T>): {
  data: T | null;
  isCached: boolean;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [isCached, setIsCached] = useState(false);

  const saveToCache = useCallback(async (value: T) => {
    const DB_NAME = 'pulse-offline-data';
    const DB_VERSION = 1;
    
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        
        if (!db.objectStoreNames.contains('data')) {
          resolve();
          return;
        }
        
        const transaction = db.transaction(['data'], 'readwrite');
        const store = transaction.objectStore('data');
        
        store.put({ key, value, timestamp: Date.now() });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data', { keyPath: 'key' });
        }
      };
    });
  }, [key]);

  const loadFromCache = useCallback(async (): Promise<T | null> => {
    return new Promise((resolve) => {
      const DB_NAME = 'pulse-offline-data';
      const DB_VERSION = 1;
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => resolve(null);
      
      request.onsuccess = () => {
        const db = request.result;
        
        if (!db.objectStoreNames.contains('data')) {
          resolve(null);
          return;
        }
        
        const transaction = db.transaction(['data'], 'readonly');
        const store = transaction.objectStore('data');
        const getReq = store.get(key);
        
        getReq.onsuccess = () => {
          resolve(getReq.result?.value || null);
        };
        
        getReq.onerror = () => resolve(null);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data', { keyPath: 'key' });
        }
      };
    });
  }, [key]);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetcher();
      setData(fresh);
      await saveToCache(fresh);
      setIsCached(true);
    } catch (error) {
      console.error(`[Offline] Failed to refresh ${key}:`, error);
    }
  }, [fetcher, key, saveToCache]);

  useEffect(() => {
    // Try to load from cache first
    loadFromCache().then((cached) => {
      if (cached) {
        setData(cached);
        setIsCached(true);
      }
      
      // Then fetch fresh data if online
      if (navigator.onLine) {
        refresh();
      }
    });
  }, [loadFromCache, refresh]);

  return {
    data,
    isCached,
    refresh
  };
}

export default useOffline;
