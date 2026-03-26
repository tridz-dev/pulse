import { formatDistanceToNow as dateFnsFormatDistanceToNow, parseISO } from 'date-fns';

/**
 * Format a date string to a relative time (e.g., "2 hours ago", "3 days ago")
 * @param date Date string or Date object
 * @param options Optional configuration
 * @returns Formatted relative time string
 */
export function formatDistanceToNow(
  date: string | Date,
  options: { addSuffix?: boolean } = {}
): string {
  const { addSuffix = true } = options;
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Unknown time';
    }
    
    return dateFnsFormatDistanceToNow(dateObj, { addSuffix });
  } catch {
    return 'Unknown time';
  }
}

/**
 * Format a date to a standard display format
 * @param date Date string or Date object
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    };
    
    return dateObj.toLocaleDateString('en-US', defaultOptions);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a date to include time
 * @param date Date string or Date object
 * @returns Formatted date and time string
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
