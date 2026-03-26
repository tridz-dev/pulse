/**
 * Offline Sync Manager
 * Handles queuing, processing, and management of offline actions
 */

export type SyncActionType = 
  | 'CREATE_SOP_RUN'
  | 'UPDATE_SOP_RUN'
  | 'COMPLETE_STEP'
  | 'ADD_NOTE'
  | 'UPLOAD_ATTACHMENT'
  | 'UPDATE_PROFILE'
  | 'CORRECTIVE_ACTION';

export type SyncPriority = 'high' | 'normal' | 'low';

export interface QueuedAction {
  id?: string;
  type: SyncActionType;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
  priority?: SyncPriority;
  retryCount?: number;
  maxRetries?: number;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

interface SyncResult {
  success: boolean;
  actionId: string;
  error?: string;
  data?: unknown;
}

interface SyncStatus {
  isProcessing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  failedCount: number;
}

const DB_NAME = 'pulse-sync-manager';
const DB_VERSION = 1;
const STORE_NAME = 'actions';

/**
 * SyncManager class for handling offline action queue
 */
class SyncManager {
  private db: IDBDatabase | null = null;
  private isProcessing = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    this.initDB();
  }

  /**
   * Initialize IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Failed to initialize sync database');
    }
    return this.db;
  }

  /**
   * Subscribe to sync status changes
   */
  public subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    
    // Send initial status
    this.getStatus().then(callback);
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Get current sync status
   */
  public async getStatus(): Promise<SyncStatus> {
    const pendingCount = this.getPendingCount();
    const actions = await this.getAllActions();
    const failedCount = actions.filter(a => (a.retryCount || 0) > 0).length;
    
    // Get last sync time from localStorage
    const lastSyncTime = localStorage.getItem('pulse-last-sync');
    
    return {
      isProcessing: this.isProcessing,
      pendingCount,
      lastSyncTime: lastSyncTime ? parseInt(lastSyncTime, 10) : null,
      failedCount
    };
  }

  /**
   * Queue an action for later sync
   */
  public async queueAction(action: QueuedAction): Promise<string> {
    const db = await this.ensureDB();
    
    const actionId = action.id || `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedAction: QueuedAction = {
      ...action,
      id: actionId,
      priority: action.priority || 'normal',
      retryCount: action.retryCount || 0,
      maxRetries: action.maxRetries || 3,
      timestamp: action.timestamp || Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(queuedAction);

      request.onsuccess = () => {
        console.log('[SyncManager] Action queued:', actionId);
        this.notifyListeners();
        resolve(actionId);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pending actions
   */
  public async getAllActions(): Promise<QueuedAction[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const actions = request.result as QueuedAction[];
        // Sort by priority and timestamp
        actions.sort((a, b) => {
          const priorityOrder = { high: 0, normal: 1, low: 2 };
          const priorityDiff = priorityOrder[a.priority || 'normal'] - priorityOrder[b.priority || 'normal'];
          if (priorityDiff !== 0) return priorityDiff;
          return (a.timestamp || 0) - (b.timestamp || 0);
        });
        resolve(actions);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get number of pending actions
   */
  public getPendingCount(): number {
    if (!this.db) {
      // Try to get from localStorage as fallback
      const count = localStorage.getItem('pulse-sync-queue-count');
      return count ? parseInt(count, 10) : 0;
    }
    
    // This is async but we want sync return
    // We'll update localStorage when actions change
    const count = localStorage.getItem('pulse-sync-queue-count');
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Update the pending count in localStorage
   */
  private async updatePendingCount(): Promise<void> {
    const actions = await this.getAllActions();
    localStorage.setItem('pulse-sync-queue-count', actions.length.toString());
  }

  /**
   * Remove an action from the queue
   */
  public async removeAction(actionId: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(actionId);

      request.onsuccess = () => {
        this.updatePendingCount();
        this.notifyListeners();
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update an action (e.g., increment retry count)
   */
  public async updateAction(action: QueuedAction): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(action);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Process all pending actions
   */
  public async processQueue(): Promise<SyncResult[]> {
    if (this.isProcessing) {
      console.log('[SyncManager] Already processing queue');
      return [];
    }

    if (!navigator.onLine) {
      console.log('[SyncManager] Cannot process queue while offline');
      return [];
    }

    this.isProcessing = true;
    this.notifyListeners();

    try {
      const actions = await this.getAllActions();
      
      if (actions.length === 0) {
        this.isProcessing = false;
        this.notifyListeners();
        return [];
      }

      console.log(`[SyncManager] Processing ${actions.length} actions`);

      const results: SyncResult[] = [];

      for (const action of actions) {
        try {
          const result = await this.executeAction(action);
          results.push(result);

          if (result.success) {
            await this.removeAction(action.id!);
          } else {
            // Increment retry count
            action.retryCount = (action.retryCount || 0) + 1;
            
            if ((action.retryCount || 0) >= (action.maxRetries || 3)) {
              // Max retries reached, move to failed
              console.error('[SyncManager] Max retries reached for:', action.id);
              await this.moveToFailed(action, result.error);
              await this.removeAction(action.id!);
            } else {
              await this.updateAction(action);
            }
          }
        } catch (error) {
          console.error('[SyncManager] Error processing action:', error);
          results.push({
            success: false,
            actionId: action.id!,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Update last sync time
      localStorage.setItem('pulse-last-sync', Date.now().toString());
      
      // Dispatch event for listeners
      window.dispatchEvent(new CustomEvent('sync-completed', { detail: results }));

      return results;
    } finally {
      this.isProcessing = false;
      this.updatePendingCount();
      this.notifyListeners();
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: QueuedAction): Promise<SyncResult> {
    const { endpoint, method, payload, headers } = action;

    // Get CSRF token
    const csrfToken = (window as Window & { csrf_token?: string }).csrf_token || '';

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken,
        ...headers
      }
    };

    if (payload && method !== 'GET') {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(endpoint, fetchOptions);

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 409) {
        // Conflict - needs manual resolution
        const conflictData = await response.json();
        return {
          success: false,
          actionId: action.id!,
          error: 'Conflict detected',
          data: conflictData
        };
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      actionId: action.id!,
      data
    };
  }

  /**
   * Move failed action to a separate store for manual resolution
   */
  private async moveToFailed(action: QueuedAction, error?: string): Promise<void> {
    const failedActions = JSON.parse(localStorage.getItem('pulse-failed-actions') || '[]');
    failedActions.push({
      ...action,
      failedAt: Date.now(),
      error
    });
    localStorage.setItem('pulse-failed-actions', JSON.stringify(failedActions));
  }

  /**
   * Get failed actions that need manual resolution
   */
  public getFailedActions(): (QueuedAction & { failedAt: number; error?: string })[] {
    return JSON.parse(localStorage.getItem('pulse-failed-actions') || '[]');
  }

  /**
   * Clear failed actions
   */
  public clearFailedActions(): void {
    localStorage.removeItem('pulse-failed-actions');
  }

  /**
   * Clear all pending actions
   */
  public async clearQueue(): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        this.updatePendingCount();
        this.notifyListeners();
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all data (queue + failed actions)
   */
  public async clearAll(): Promise<void> {
    await this.clearQueue();
    this.clearFailedActions();
    localStorage.removeItem('pulse-last-sync');
    localStorage.removeItem('pulse-sync-queue-count');
  }
}

// Export singleton instance
export const syncManager = new SyncManager();

// Export individual functions for convenience
export const queueAction = (action: QueuedAction) => syncManager.queueAction(action);
export const processQueue = () => syncManager.processQueue();
export const getPendingCount = () => syncManager.getPendingCount();
export const clearQueue = () => syncManager.clearQueue();
export const getSyncStatus = () => syncManager.getStatus();
export const getFailedActions = () => syncManager.getFailedActions();
export const clearFailedActions = () => syncManager.clearFailedActions();
export const subscribeToSyncStatus = (callback: (status: SyncStatus) => void) => 
  syncManager.subscribe(callback);

export default syncManager;
