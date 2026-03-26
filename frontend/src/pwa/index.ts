/**
 * PWA Module - Progressive Web App functionality
 * 
 * This module provides offline support, background sync, and PWA features
 * for the Pulse application.
 * 
 * @module pwa
 */

// Service Worker
export { 
  registerServiceWorker, 
  unregisterServiceWorker, 
  updateServiceWorker,
  skipWaiting,
  useServiceWorker,
  usePWAInstall 
} from './registerSW';

// Offline hooks and state
export { 
  useOffline, 
  useOfflineCache,
  type OfflineData,
  type UseOfflineReturn 
} from './useOffline';

// Sync Manager
export { 
  syncManager,
  queueAction,
  processQueue,
  getPendingCount,
  clearQueue,
  getSyncStatus,
  getFailedActions,
  clearFailedActions,
  subscribeToSyncStatus,
  type SyncActionType,
  type SyncPriority,
  type QueuedAction 
} from './syncManager';

// Components
export { 
  OfflineBanner, 
  OfflineIndicator,
  default as OfflineBannerDefault 
} from './OfflineBanner';

export { 
  InstallPWA, 
  PWASettings,
  default as InstallPWADefault 
} from './InstallPWA';

export { PWAProvider } from './PWAProvider';
