import { useEffect } from 'react';
import { isRTLLanguage } from './index';

/**
 * RTL (Right-to-Left) Support Utilities
 * 
 * This module provides utilities for handling RTL languages (Arabic, Hebrew, etc.)
 * and automatically applying appropriate styles.
 */

// CSS classes to apply for RTL layouts
const RTL_CLASSES = {
  // Flip margins/paddings
  ml: 'mr',
  mr: 'ml',
  pl: 'pr',
  pr: 'pl',
  // Text alignment
  'text-left': 'text-right',
  'text-right': 'text-left',
  // Flex directions
  'flex-row': 'flex-row-reverse',
  'flex-row-reverse': 'flex-row',
  // Positioning
  'left-0': 'right-0',
  'right-0': 'left-0',
  'border-l': 'border-r',
  'border-r': 'border-l',
  // Floats (if used)
  'float-left': 'float-right',
  'float-right': 'float-left',
};

/**
 * Hook to initialize and watch RTL direction changes
 */
export function useRTL() {
  useEffect(() => {
    // Initial check
    const currentLang = document.documentElement.lang || 'en';
    applyRTLStyles(isRTLLanguage(currentLang));

    // Listen for language changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'lang' || mutation.attributeName === 'dir') {
          const lang = document.documentElement.lang || 'en';
          applyRTLStyles(isRTLLanguage(lang));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'dir'],
    });

    return () => observer.disconnect();
  }, []);
}

/**
 * Apply RTL styles to document
 */
export function applyRTLStyles(isRTL: boolean): void {
  if (typeof document === 'undefined') return;

  const html = document.documentElement;
  
  if (isRTL) {
    html.dir = 'rtl';
    html.setAttribute('data-dir', 'rtl');
    html.classList.add('rtl');
    
    // Add RTL-specific CSS if not already present
    if (!document.getElementById('pulse-rtl-styles')) {
      const style = document.createElement('style');
      style.id = 'pulse-rtl-styles';
      style.textContent = RTL_STYLES;
      document.head.appendChild(style);
    }
  } else {
    html.dir = 'ltr';
    html.setAttribute('data-dir', 'ltr');
    html.classList.remove('rtl');
    
    // Remove RTL styles
    const rtlStyle = document.getElementById('pulse-rtl-styles');
    if (rtlStyle) {
      rtlStyle.remove();
    }
  }
}

/**
 * Get mirrored class name for RTL layouts
 */
export function getRTLClass(className: string, isRTL: boolean): string {
  if (!isRTL) return className;
  
  let result = className;
  Object.entries(RTL_CLASSES).forEach(([ltr, rtl]) => {
    // Use word boundaries to match complete class names
    const regex = new RegExp(`\\b${ltr}\\b`, 'g');
    result = result.replace(regex, rtl);
  });
  
  return result;
}

/**
 * RTL CSS styles injected when RTL is active
 */
const RTL_STYLES = `
  /* RTL Layout Adjustments */
  .rtl {
    /* Mirror sidebar */
    aside[role="navigation"] {
      border-right: none;
      border-left: 1px solid var(--border);
    }
    
    /* Adjust scrollbar position */
    .scrollbar-thin {
      direction: rtl;
    }
    
    /* Mirror icons that indicate direction */
    .rtl-mirror {
      transform: scaleX(-1);
    }
    
    /* Flip margins for inline elements */
    .rtl-ml-auto {
      margin-left: 0;
      margin-right: auto;
    }
    
    .rtl-mr-auto {
      margin-right: 0;
      margin-left: auto;
    }
  }
  
  /* Arabic font support */
  .font-arabic {
    font-family: 'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', sans-serif;
  }
`;

/**
 * Utility to conditionally apply RTL classes
 */
export function cnWithRTL(baseClasses: string, isRTL: boolean): string {
  if (!isRTL) return baseClasses;
  
  // For Tailwind, we need to manually swap directional classes
  const swaps: Record<string, string> = {
    'ml-': 'mr-',
    'mr-': 'ml-',
    'pl-': 'pr-',
    'pr-': 'pl-',
    'text-left': 'text-right',
    'text-right': 'text-left',
    'border-l-': 'border-r-',
    'border-r-': 'border-l-',
    'rounded-l-': 'rounded-r-',
    'rounded-r-': 'rounded-l-',
    'rounded-tl-': 'rounded-tr-',
    'rounded-tr-': 'rounded-tl-',
    'rounded-bl-': 'rounded-br-',
    'rounded-br-': 'rounded-bl-',
    'left-': 'right-',
    'right-': 'left-',
  };
  
  let result = baseClasses;
  Object.entries(swaps).forEach(([ltr, rtl]) => {
    // Replace at word boundaries or start of string
    const regex = new RegExp(`(^|\\s)${ltr}`, 'g');
    result = result.replace(regex, `$1${rtl}`);
  });
  
  return result;
}

export default {
  useRTL,
  applyRTLStyles,
  getRTLClass,
  cnWithRTL,
};
