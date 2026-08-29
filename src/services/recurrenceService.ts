import { addDays, addMonths, addWeeks, addYears, startOfWeek } from 'date-fns';
import type { CalendarEvent, RecurrenceRule } from '../types';

/**
 * Recurrence for locally created events.
 *
 * Imported .ics events arrive already expanded by ical.js (see icsService), so
 * this module exists only for events the user creates in the app. We deliberately
 * do NOT pull ical.js in here: it is lazy-loaded as an 80KB chunk, and expansion
 * runs on every render pass that draws the grid — it has to be synchronous and
 * cheap. The rule shape we support is correspondingly narrow (see RecurrenceRule).
 *
 * The master event is the only thing persisted. Occurrences are derived on read,
 * so editing a series is editing one object, and a series can extend indefinitely
 * without unbounded storage.
 */

/** Safety cap on occurrences emitted per series, mirroring icsService. */
const DEFAULT_MAX_OCCURRENCES = 750;
/** Hard ceiling on candidate steps so a pathological rule can't spin forever. */
const ITERATION_GUARD = 10_000;

/** Separator between a series id and the occurrence's start time. */
const OCCURRENCE_SEP = '::';

/**
 * Id for a generated occurrence. Stable for a given series + start instant, which
 * is what lets React keys, EXDATE matching and "edit this one" all agree.
 */
export function occurrenceId(seriesId: string, startMs: number): string {
  return `${seriesId}${OCCURRENCE_SEP}${startMs}`;
}

/** Recover the master event's id from an occurrence id (or return it unchanged). */
export function seriesIdOf(eventId: string): string {
  const i = eventId.indexOf(OCCURRENCE_SEP);
  return i === -1 ? eventId : eventId.slice(0, i);
}

/** True if this id refers to a generated occurrence rather than a stored event. */
export function isOccurrenceId(eventId: string): boolean {
  return eventId.includes(OCCURRENCE_SEP);
}

/**
 * The start instant encoded in an occurrence id, or null for a plain id. This is
 * the occurrence's ORIGINAL start — what EXDATE must match — which is not the
 * same as the start the user may have just dragged it to.
 */
export function occurrenceStartOf(eventId: string): number | null {
  const i = eventId.indexOf(OCCURRENCE_SEP);
  if (i === -1) return null;
  const ms = Number(eventId.slice(i + OCCURRENCE_SEP.length));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Advance from `start` by `n` rule intervals.
 *
 * Stepping from the ORIGINAL start each time rather than iteratively from the
 * previous occurrence matters: iterative addMonths would let a clamped February
 * drag the whole rest of the series back to the 28th.
 */
function advance(start: Date, rule: RecurrenceRule, n: number): Date {
  const step = rule.interval * n;
  switch (rule.frequency) {
    case 'daily':
      return addDays(start, step);
    case 'weekly':
      return addWeeks(start, step);
    case 'monthly':
      return addMonths(start, step);
    case 'yearly':
      return addYears(start, step);
  }
}

/**
 * Candidate start dates in chronological order, ignoring range and exclusions.
 *
 * Monthly/yearly candidates that land on a clamped date are yielded anyway and
 * filtered by the caller, so that COUNT semantics stay aligned with the rule.
 */
function* candidates(start: Date, rule: RecurrenceRule): Generator<Date> {
  // Weekly with explicit weekdays expands within each week rather than striding
  // a single day-of-week — this is what makes "every Mon/Wed/Fri" work.
  if (rule.frequency === 'weekly' && rule.byWeekDay?.length) {
    // Week containing DTSTART, normalised to Monday (RFC 5545's default WKST).
    const baseWeek = startOfWeek(start, { weekStartsOn: 1 });
    // Monday-relative offsets, ascending, so occurrences come out in order.
    const offsets = [...new Set(rule.byWeekDay)]
      .map((wd) => (wd + 6) % 7) // JS 0=Sun..6=Sat -> 0=Mon..6=Sun
      .sort((a, b) => a - b);

    for (let w = 0; ; w++) {
      const weekStart = addWeeks(baseWeek, w * rule.interval);
      for (const offset of offsets) {
        const day = addDays(weekStart, offset);
        // Carry DTSTART's wall-clock time onto each generated day.
        const occ = new Date(day);
        occ.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
        // The first week can contain weekdays that precede DTSTART itself.
        if (occ.getTime() < start.getTime()) continue;
        yield occ;
      }
    }
  }

  for (let n = 0; ; n++) {
    yield advance(start, rule, n);
  }
}

/**
 * Monthly and yearly rules can name a day that a given month lacks (the 31st of
 * February). RFC 5545 drops those occurrences; date-fns clamps them instead, so
 * we detect the clamp and drop it ourselves to avoid inventing a Feb 28 event.
 */
function isClamped(candidate: Date, start: Date, rule: RecurrenceRule): boolean {
  if (rule.frequency !== 'monthly' && rule.frequency !== 'yearly') return false;
  return candidate.getDate() !== start.getDate();
}

function exclusionSet(rule: RecurrenceRule): Set<number> {
  return new Set((rule.exDates ?? []).map((d) => new Date(d).getTime()));
}

export interface ExpandOptions {
  /** Only emit occurrences overlapping [rangeStart, rangeEnd]. */
  rangeStart: Date;
  rangeEnd: Date;
  /** Safety cap on occurrences emitted per series. */
  maxOccurrences?: number;
}

/**
 * Expand one event into the occurrences that fall inside the requested window.
 *
 * Non-recurring events pass through unchanged (returned as-is when they overlap
 * the window, so identity is preserved for callers that compare by reference).
 */
export function expandRecurringEvent(master: CalendarEvent, opts: ExpandOptions): CalendarEvent[] {
  const { rangeStart, rangeEnd } = opts;
  const rule = master.recurrence;

  if (!rule || rule.interval < 1) {
    return master.start <= rangeEnd && master.end >= rangeStart ? [master] : [];
  }

  const max = opts.maxOccurrences ?? DEFAULT_MAX_OCCURRENCES;
  // Preserving duration (rather than wall-clock end) is what keeps a 23:00–01:00
  // event two hours long on every occurrence, including across a DST boundary.
  const durationMs = master.end.getTime() - master.start.getTime();
  const excluded = exclusionSet(rule);
  const until = rule.endDate ? new Date(rule.endDate).getTime() : null;

  const out: CalendarEvent[] = [];
  let generated = 0; // counts toward COUNT — exclusions still consume it, per RFC 5545
  let steps = 0;

  for (const candidate of candidates(master.start, rule)) {
    if (++steps > ITERATION_GUARD) break;
    if (isClamped(candidate, master.start, rule)) continue;

    const startMs = candidate.getTime();
    if (until !== null && startMs > until) break;
    if (rule.count != null && generated >= rule.count) break;
    generated++;

    const endMs = startMs + durationMs;
    // Occurrences are chronological, so once we are past the window we are done.
    if (startMs > rangeEnd.getTime()) break;
    if (endMs < rangeStart.getTime()) continue;
    if (excluded.has(startMs)) continue;

    out.push({
      ...master,
      id: occurrenceId(master.id, startMs),
      start: new Date(startMs),
      end: new Date(endMs),
      seriesId: master.id,
    });

    if (out.length >= max) break;
  }

  return out;
}

/**
 * Expand a whole event list for a window. Events without a recurrence rule are
 * passed through, so callers can use this as the single source for rendering.
 */
export function expandEvents(events: CalendarEvent[], opts: ExpandOptions): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const event of events) {
    for (const occurrence of expandRecurringEvent(event, opts)) {
      out.push(occurrence);
    }
  }
  return out;
}

/** Human-readable summary of a rule, e.g. "Every 2 weeks on Mon, Wed". */
export function describeRecurrence(rule: RecurrenceRule): string {
  const { frequency, interval } = rule;
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[frequency];
  let text = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;

  if (frequency === 'weekly' && rule.byWeekDay?.length) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [...rule.byWeekDay].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    text += ` on ${days.map((d) => names[d]).join(', ')}`;
  }

  if (rule.count != null) text += `, ${rule.count} times`;
  else if (rule.endDate) text += `, until ${new Date(rule.endDate).toLocaleDateString()}`;

  return text;
}
