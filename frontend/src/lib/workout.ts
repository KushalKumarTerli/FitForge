// A single workout session realistically doesn't run longer than this. Anything beyond it
// is almost certainly a tab left open without pausing rather than a real session, so both the
// write path (Workout.tsx, on Finish) and the read path (DashboardStats' vs-yesterday
// comparison) treat it as untrustworthy rather than displaying it as-is.
export const MAX_REASONABLE_SESSION_SECONDS = 4 * 60 * 60
