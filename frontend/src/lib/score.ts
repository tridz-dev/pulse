/**
 * Single source of truth for score→status mapping across the app.
 * total === 0 (or missing) is the null/no-data case — grey, never red, never
 * coerced to a 0% score. See pulse_design/DESIGN.md "Do/Don't".
 */

export type ScoreStatus = "pass" | "risk" | "fail" | "none"

export function scoreStatus(score: number | null | undefined, total?: number): ScoreStatus {
  if (score == null || (total !== undefined && total <= 0)) return "none"
  if (score >= 85) return "pass"
  if (score >= 20) return "risk"
  return "fail"
}

const STATUS_TEXT_CLASS: Record<ScoreStatus, string> = {
  pass: "text-pass",
  risk: "text-risk",
  fail: "text-fail",
  none: "text-faint",
}

export function scoreTextClass(score: number | null | undefined, total?: number): string {
  return STATUS_TEXT_CLASS[scoreStatus(score, total)]
}

const STATUS_BG_CLASS: Record<ScoreStatus, string> = {
  pass: "bg-pass",
  risk: "bg-risk",
  fail: "bg-fail",
  none: "bg-none",
}

export function scoreBgClass(score: number | null | undefined, total?: number): string {
  return STATUS_BG_CLASS[scoreStatus(score, total)]
}

/** Formats a score for display: "—" for no-data, rounded integer + "%" otherwise. */
export function formatScore(score: number | null | undefined, total?: number): string {
  if (scoreStatus(score, total) === "none") return "—"
  return `${Math.round(score as number)}%`
}
