/**
 * Determines if a bucket represents a partial/incomplete period.
 *
 * A bucket is partial when its date equals today — the day hasn't finished,
 * so any data for today is incomplete.
 *
 * @param bucketDateISO ISO date string (YYYY-MM-DD) of the data point
 * @param todayISO ISO date string (YYYY-MM-DD) of today
 * @returns true if the bucket is today (and therefore partial), false otherwise
 */
export function isPartialBucket(bucketDateISO: string, todayISO: string): boolean {
  return bucketDateISO === todayISO;
}
