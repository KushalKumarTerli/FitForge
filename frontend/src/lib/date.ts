export function toDateStr(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Monday-start week. Returns midnight of the Monday on/before `d`. */
export function startOfWeekMonday(d: Date) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  const dow = copy.getDay() // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow
  copy.setDate(copy.getDate() + diff)
  return copy
}

/**
 * "Today" as ISO instant bounds in the caller's local timezone — the single source of truth
 * for filtering timestamptz columns (e.g. meals.logged_at) to "today", so every caller (Quick
 * Log, Nutrition Summary, the Health Coach's backend context) agrees on the same boundary
 * instead of each computing its own slightly different version.
 */
export function getTodayBounds(now: Date = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}
