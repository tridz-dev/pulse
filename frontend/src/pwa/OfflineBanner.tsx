/**
 * Offline Banner Component
 * Shows network status and pending sync information
 */

import React, { useState, useEffect } from 'react';
import { useOffline } from './useOffline';
import { 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface OfflineBannerProps {
  position?: 'top' | 'bottom';
  showDismiss?: boolean;
}

/**
 * OfflineBanner - Displays network status and sync information
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({ 
  position = 'top',
  showDismiss = true 
}) => {
  const { 
    isOffline, 
    isSyncing, 
    pendingCount, 
    lastSyncTime,
    retrySync 
  } = useOffline();
  
  const [isDismissed, setIsDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset dismissed state when going offline
  useEffect(() => {
    if (isOffline) {
      setIsDismissed(false);
    }
  }, [isOffline]);

  // Show success message after sync
  useEffect(() => {
    if (!isSyncing && pendingCount === 0 && lastSyncTime) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, pendingCount, lastSyncTime]);

  const handleRetry = async () => {
    await retrySync();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Don't show if dismissed and online with no pending actions
  if (isDismissed && !isOffline && pendingCount === 0 && !showSuccess) {
    return null;
  }

  // Format last sync time
  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const positionClasses = position === 'top' 
    ? 'top-0 left-0 right-0' 
    : 'bottom-0 left-0 right-0';

  // Render offline state
  if (isOffline) {
    return (
      <div 
        className={cn(
          'fixed z-50 px-4 py-3',
          positionClasses
        )}
        role="alert"
        aria-live="assertive"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between rounded-lg bg-amber-500 px-4 py-3 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">You're offline</p>
                <p className="text-sm text-amber-100">
                  {pendingCount > 0 
                    ? `${pendingCount} action${pendingCount > 1 ? 's' : ''} queued for sync`
                    : 'Changes will sync when you reconnect'
                  }
                </p>
              </div>
            </div>
            
            {showDismiss && (
              <button
                onClick={handleDismiss}
                className="rounded p-1 hover:bg-amber-600 transition-colors"
                aria-label="Dismiss offline notification"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render syncing state
  if (isSyncing) {
    return (
      <div 
        className={cn(
          'fixed z-50 px-4 py-3',
          positionClasses
        )}
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between rounded-lg bg-indigo-500 px-4 py-3 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
              <div>
                <p className="font-medium">Syncing...</p>
                <p className="text-sm text-indigo-100">
                  Uploading pending changes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render pending actions state
  if (pendingCount > 0) {
    return (
      <div 
        className={cn(
          'fixed z-50 px-4 py-3',
          positionClasses
        )}
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between rounded-lg bg-blue-500 px-4 py-3 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  {pendingCount} pending {pendingCount === 1 ? 'change' : 'changes'}
                </p>
                <p className="text-sm text-blue-100">
                  Last synced: {formatLastSync(lastSyncTime)}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 rounded-md bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Sync Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render success state
  if (showSuccess) {
    return (
      <div 
        className={cn(
          'fixed z-50 px-4 py-3',
          positionClasses
        )}
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between rounded-lg bg-emerald-500 px-4 py-3 text-white shadow-lg animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">All changes synced</p>
                <p className="text-sm text-emerald-100">
                  You're up to date
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render online state (compact)
  return (
    <div 
      className={cn(
        'fixed z-50 px-4 py-2',
        positionClasses
      )}
    >
      <div className="mx-auto max-w-7xl flex justify-end">
        <div 
          className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
          title={`Last synced: ${formatLastSync(lastSyncTime)}`}
        >
          <Wifi className="h-3 w-3" />
          <span>Online</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact offline indicator for use in headers/toolbars
 */
export const OfflineIndicator: React.FC = () => {
  const { isOffline, pendingCount, isSyncing } = useOffline();

  if (isSyncing) {
    return (
      <div 
        className="flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700"
        title="Syncing changes..."
      >
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Syncing</span>
      </div>
    );
  }

  if (isOffline) {
    return (
      <div 
        className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700"
        title={`${pendingCount} changes queued`}
      >
        <WifiOff className="h-3 w-3" />
        <span>Offline</span>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px]">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div 
        className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 cursor-pointer hover:bg-blue-200 transition-colors"
        title="Click to sync"
      >
        <AlertCircle className="h-3 w-3" />
        <span>{pendingCount} pending</span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
      title="Online and synced"
    >
      <Wifi className="h-3 w-3" />
      <span>Online</span>
    </div>
  );
};

export default OfflineBanner;
