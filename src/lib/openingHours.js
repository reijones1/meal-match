const MS_PER_MINUTE = 60000

// Google's convention for "open 24 hours, 7 days a week": a single period opening Sunday at
// 00:00 with no close field at all (a period that closes exactly 24h later, e.g. open-24h on
// just one day, DOES have a close — this is specifically the "always open" case).
function isAlwaysOpenPeriods(periods) {
  return (
    periods.length === 1 &&
    !periods[0].close &&
    periods[0].open?.day === 0 &&
    periods[0].open?.hour === 0 &&
    periods[0].open?.minute === 0
  )
}

// Converts a period boundary (weekday 0-6 + hour/minute, meaning wall-clock time *at the
// place*) into a real, timezone-agnostic epoch-ms instant — anchored to the most recent
// occurrence of that weekday at-or-before "today" at the place (today, or up to 6 days ago,
// which is exactly the window needed to catch an overnight period that started yesterday).
function boundaryToEpochMs(boundary, placeLocalDate, utcOffsetMinutes) {
  const todayDow = placeLocalDate.getUTCDay()
  let dayDelta = (boundary.day - todayDow + 7) % 7
  if (dayDelta !== 0) dayDelta -= 7

  const shiftedMs = Date.UTC(
    placeLocalDate.getUTCFullYear(),
    placeLocalDate.getUTCMonth(),
    placeLocalDate.getUTCDate() + dayDelta,
    boundary.hour,
    boundary.minute,
  )
  // shiftedMs is in the "place-local read as UTC" frame used for the getUTC* comparisons
  // above; undo that shift to recover the true absolute instant.
  return shiftedMs - utcOffsetMinutes * MS_PER_MINUTE
}

function periodToRange(period, placeLocalDate, utcOffsetMinutes) {
  const openMs = boundaryToEpochMs(period.open, placeLocalDate, utcOffsetMinutes)
  if (!period.close) return { openMs, closeMs: null }

  // Restaurant hours never span more than one extra calendar day past opening.
  const dayAdvance = period.close.day === period.open.day ? 0 : 1
  const openAnchorShifted = new Date(openMs + utcOffsetMinutes * MS_PER_MINUTE)
  const closeShiftedMs = Date.UTC(
    openAnchorShifted.getUTCFullYear(),
    openAnchorShifted.getUTCMonth(),
    openAnchorShifted.getUTCDate() + dayAdvance,
    period.close.hour,
    period.close.minute,
  )
  return { openMs, closeMs: closeShiftedMs - utcOffsetMinutes * MS_PER_MINUTE }
}

// Scans every period for one covering "now" (checking each period's most recent occurrence,
// today or up to 6 days back, is what correctly catches an overnight period that opened
// yesterday and hasn't closed yet). Returns the covering period's close info, or `undefined`
// if no period covers now. `closeHour`/`closeMinute` are the place's own wall-clock close
// time (straight from the API, not derived from `closeMs`) — used for display so "closes at"
// always reflects the restaurant's own clock, not whatever timezone the viewer's browser
// happens to be set to.
function findActivePeriod(periods, utcOffsetMinutes, now) {
  const placeLocalDate = new Date(now.getTime() + utcOffsetMinutes * MS_PER_MINUTE)
  const nowMs = now.getTime()

  for (const period of periods) {
    if (!period.open) continue
    const { openMs, closeMs } = periodToRange(period, placeLocalDate, utcOffsetMinutes)
    if (closeMs == null) {
      if (nowMs >= openMs) return { closesAtMs: null, closeHour: null, closeMinute: null }
      continue
    }
    if (nowMs >= openMs && nowMs < closeMs) {
      return { closesAtMs: closeMs, closeHour: period.close.hour, closeMinute: period.close.minute }
    }
  }
  return undefined
}

// Determines whether a place is open right now and, if so, when its current period closes.
// Deliberately doesn't use the Places (New) library's `Place.isOpen()` — that method is only
// available on Google's beta script channel, and this app loads the stable one — so open/
// closed is computed directly from `regularOpeningHours.periods` instead.
export async function getOpenStatus(place, now = new Date()) {
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
    return { hoursAvailable: true, isOpenNow: false, isAlwaysOpen: false, closesAtMs: null }
  }

  const periods = place.regularOpeningHours?.periods
  if (!periods?.length || place.utcOffsetMinutes == null) {
    return { hoursAvailable: false, isOpenNow: null, isAlwaysOpen: false, closesAtMs: null }
  }

  if (isAlwaysOpenPeriods(periods)) {
    return { hoursAvailable: true, isOpenNow: true, isAlwaysOpen: true, closesAtMs: null, closeHour: null, closeMinute: null }
  }

  const active = findActivePeriod(periods, place.utcOffsetMinutes, now)
  if (active === undefined) {
    return { hoursAvailable: true, isOpenNow: false, isAlwaysOpen: false, closesAtMs: null, closeHour: null, closeMinute: null }
  }

  return { hoursAvailable: true, isOpenNow: true, isAlwaysOpen: false, ...active }
}

// Formats a status from getOpenStatus() into the short label shown next to the clock icon on
// a card — deliberately compact (paired with an icon that already says "this is about
// hours"), not a full sentence. Only ever called for restaurants already known to still be
// worth showing (open, or unknown hours) — a "closed now" restaurant is filtered out of the
// results entirely, not labeled.
export function formatOpenStatus(status, now = new Date()) {
  if (!status.hoursAvailable) return 'Hours unavailable'
  if (!status.isOpenNow) return 'Closed now'
  if (status.isAlwaysOpen) return '24 hrs'
  if (status.closesAtMs == null) return 'Open now'

  const remainingMin = Math.round((status.closesAtMs - now.getTime()) / MS_PER_MINUTE)
  if (remainingMin > 0 && remainingMin <= 60) return `${remainingMin} min`

  return formatHour12(status.closeHour, status.closeMinute)
}

// Formats the restaurant's own wall-clock close time directly (not via toLocaleTimeString on
// an absolute instant) so it always reads as *that place's* clock, not whatever timezone the
// viewer's browser happens to be set to. Minutes are only shown when non-zero ("10 PM", but
// "10:05 PM") to keep the common case as short as possible.
function formatHour12(hour, minute) {
  const period = hour < 12 ? 'AM' : 'PM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  if (minute === 0) return `${hour12} ${period}`
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}
