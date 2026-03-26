/**
 * PWA Provider Component
 * Wraps the app with PWA functionality: service worker registration, 
 * offline detection, install prompts, and banners
 */

import { useEffect } from 'react';
import { registerServiceWorker, useServiceWorker, usePWAInstall } from './registerSW';
import { OfflineBanner } from './OfflineBanner';
import { InstallPWA } from './InstallPWA';

interface PWAProviderProps {
  children: React.ReactNode;
}

/**
 * PWAProvider - Provides PWA functionality to the application
 * 
 * This component:
 * 1. Registers the service worker
 * 2. Shows offline/online status banner
 * 3. Shows PWA install prompt
 * 4. Logs PWA status for debugging
 */
export function PWAProvider({ children }: PWAProviderProps) {
  // Initialize service worker hooks
  const { isRegistered, isUpdateAvailable, update } = useServiceWorker();
  const { isInstallable, isInstalled } = usePWAInstall();

  // Register service worker on mount
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Log PWA status for debugging
  useEffect(() => {
    if (isRegistered) {
      console.log('[PWA] Service worker registered');
    }
  }, [isRegistered]);

  useEffect(() => {
    if (isUpdateAvailable) {
      console.log('[PWA] Update available');
      // Auto-update after a delay
      const timer = setTimeout(() => {
        update();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isUpdateAvailable, update]);

  useEffect(() => {
    if (isInstalled) {
      console.log('[PWA] App is installed');
    }
  }, [isInstalled]);

  useEffect(() => {
    if (isInstallable) {
      console.log('[PWA] App is installable');
    }
  }, [isInstallable]);

  return (
    <>
      {/* PWA Install Prompt */}
      <InstallPWA variant="banner" position="bottom" />
      
      {/* Offline Status Banner */}
      <OfflineBanner position="top" />
      
      {/* App content */}
      {children}
    </>
  );
}

export default PWAProvider;
