/**
 * PWA Install Prompt Component
 * Detects installability and shows custom install UI
 */

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  X, 
  Smartphone, 
  CheckCircle2,
  Share2,
  PlusSquare
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { usePWAInstall } from './registerSW';

// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InstallPWAProps {
  variant?: 'banner' | 'card' | 'button';
  position?: 'top' | 'bottom' | 'inline';
  dismissDuration?: number; // Days to remember dismissal
}

/**
 * InstallPWA - PWA installation prompt component
 */
export const InstallPWA: React.FC<InstallPWAProps> = ({ 
  variant = 'banner',
  position = 'bottom',
  dismissDuration = 7
}) => {
  const { isInstallable, isInstalled, install, dismiss } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // Check if previously dismissed
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const dismissedDate = parseInt(dismissedAt, 10);
      const daysSinceDismissed = (Date.now() - dismissedDate) / (1000 * 60 * 60 * 24);
      
      if (daysSinceDismissed < dismissDuration) {
        return; // Still within dismissal period
      }
    }

    // Detect iOS/Safari for manual install instructions
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
    const isSafariBrowser = /Safari/.test(ua) && !/Chrome/.test(ua);
    
    setIsIOS(isIOSDevice);
    setIsSafari(isSafariBrowser);

    // Show if installable or on iOS Safari
    if (isInstallable || (isIOSDevice && isSafariBrowser)) {
      setIsVisible(true);
    }
  }, [isInstallable, dismissDuration]);

  const handleInstall = async () => {
    setIsInstalling(true);
    
    try {
      const accepted = await install();
      
      if (accepted) {
        setShowSuccess(true);
        setTimeout(() => {
          setIsVisible(false);
        }, 2000);
      }
    } catch (error) {
      console.error('[PWA] Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    dismiss();
  };

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  // Don't show if not visible
  if (!isVisible) {
    return null;
  }

  // Success state
  if (showSuccess) {
    return (
      <div className={cn(
        'fixed z-50 px-4 py-3',
        position === 'top' ? 'top-0 left-0 right-0' : 'bottom-0 left-0 right-0'
      )}>
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-4 text-white shadow-lg">
            <CheckCircle2 className="h-6 w-6" />
            <span className="text-lg font-medium">Pulse installed successfully!</span>
          </div>
        </div>
      </div>
    );
  }

  // iOS Safari manual install instructions
  if (isIOS && isSafari) {
    return (
      <div className={cn(
        'fixed z-50 px-4 py-3',
        position === 'top' ? 'top-0 left-0 right-0' : 'bottom-0 left-0 right-0'
      )}>
        <div className="mx-auto max-w-7xl">
          <div className="relative rounded-lg bg-indigo-600 px-6 py-5 text-white shadow-lg">
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-3 rounded-full p-1 hover:bg-indigo-700 transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-indigo-500 p-3">
                <Smartphone className="h-6 w-6" />
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Add Pulse to Home Screen</h3>
                <p className="mt-1 text-indigo-100">
                  Install Pulse for quick access and offline support
                </p>
                
                <div className="mt-4 flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 rounded bg-indigo-700 px-3 py-2">
                    <span>1.</span>
                    <Share2 className="h-4 w-4" />
                    <span>Tap Share</span>
                  </div>
                  <div className="flex items-center gap-2 rounded bg-indigo-700 px-3 py-2">
                    <span>2.</span>
                    <PlusSquare className="h-4 w-4" />
                    <span>Add to Home Screen</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant
  if (variant === 'banner') {
    return (
      <div className={cn(
        'fixed z-50 px-4 py-3',
        position === 'top' ? 'top-0 left-0 right-0' : 'bottom-0 left-0 right-0'
      )}>
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between rounded-lg bg-indigo-600 px-4 py-3 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-indigo-500 p-2">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Install Pulse App</p>
                <p className="text-sm text-indigo-100">
                  Faster access and offline support
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isInstalling ? 'Installing...' : 'Install'}
              </button>
              
              <button
                onClick={handleDismiss}
                className="rounded p-2 hover:bg-indigo-700 transition-colors"
                aria-label="Dismiss install prompt"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Card variant
  if (variant === 'card') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-indigo-100 p-3">
              <Download className="h-8 w-8 text-indigo-600" />
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <h3 className="mt-4 text-xl font-semibold text-gray-900">
            Install Pulse
          </h3>
          
          <p className="mt-2 text-gray-600">
            Install Pulse on your device for:
          </p>
          
          <ul className="mt-4 space-y-3">
            <li className="flex items-center gap-3 text-gray-700">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>Fast, app-like experience</span>
            </li>
            <li className="flex items-center gap-3 text-gray-700">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>Work offline without internet</span>
            </li>
            <li className="flex items-center gap-3 text-gray-700">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>Push notifications for alerts</span>
            </li>
            <li className="flex items-center gap-3 text-gray-700">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>Home screen shortcut</span>
            </li>
          </ul>
          
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-center font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isInstalling ? 'Installing...' : 'Install App'}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Button variant (inline)
  return (
    <button
      onClick={handleInstall}
      disabled={isInstalling}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
        position === 'inline' && 'w-full justify-center'
      )}
    >
      <Download className="h-4 w-4" />
      {isInstalling ? 'Installing...' : 'Install App'}
    </button>
  );
};

/**
 * Settings page PWA install section
 */
export const PWASettings: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
  }, []);

  if (isInstalled) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <div>
            <h4 className="font-medium text-emerald-900">App Installed</h4>
            <p className="text-sm text-emerald-700">
              Pulse is installed on your device
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="font-medium text-gray-900">Install Pulse App</h4>
      <p className="mt-1 text-sm text-gray-600">
        Install Pulse on your device for faster access and offline support.
      </p>
      
      {isIOS ? (
        <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">iOS Installation:</p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Tap the Share button in Safari</li>
            <li>Scroll down and tap "Add to Home Screen"</li>
          </ol>
        </div>
      ) : (
        <button
          onClick={() => install()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          Install Now
        </button>
      )}
    </div>
  );
};

export default InstallPWA;
