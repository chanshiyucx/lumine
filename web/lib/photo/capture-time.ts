import type { PhotoCaptureTime } from '.'

// Some cameras record a local wall-clock time without a trailing `Z` or `±hh:mm`.
const UTC_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/

const offsetFormatters = new Map<string, Intl.DateTimeFormat>()

/**
 * Gives a capture time without a UTC offset the offset its album's time zone had at
 * that moment, or UTC when the album has none, so every capture time compares and
 * formats the same way. Never throws: an unknown time zone also falls back to UTC.
 */
export function resolveTakenAt(takenAt: string, timeZone?: string) {
  if (UTC_OFFSET_PATTERN.test(takenAt)) {
    return takenAt
  }

  return `${takenAt}${formatUtcOffset(getUtcOffsetMinutes(takenAt, timeZone))}`
}

function getUtcOffsetMinutes(localDateTime: string, timeZone?: string) {
  if (!timeZone) {
    return 0
  }

  try {
    // Read the wall-clock time as if it were UTC, then shift by the zone's offset; the
    // second lookup lands on the right side of a daylight saving change.
    const wallClockAsUtc = Date.parse(`${localDateTime}Z`)
    const firstGuess = readUtcOffsetMinutes(timeZone, wallClockAsUtc)

    return readUtcOffsetMinutes(timeZone, wallClockAsUtc - firstGuess * 60_000)
  } catch {
    return 0
  }
}

function readUtcOffsetMinutes(timeZone: string, instant: number) {
  let formatter = offsetFormatters.get(timeZone)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en', {
      timeZone,
      timeZoneName: 'longOffset',
    })
    offsetFormatters.set(timeZone, formatter)
  }

  const offsetName = formatter
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value
  // "GMT+03:00"; plain "GMT" means UTC.
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offsetName ?? '')

  if (!match) {
    return 0
  }

  const minutes = Number(match[2]) * 60 + Number(match[3])

  return match[1] === '-' ? -minutes : minutes
}

function formatUtcOffset(minutes: number) {
  if (minutes === 0) {
    return 'Z'
  }

  const absolute = Math.abs(minutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const remainder = String(absolute % 60).padStart(2, '0')

  return `${minutes > 0 ? '+' : '-'}${hours}:${remainder}`
}

const captureTimeFormatters = new Map<
  string,
  { date: Intl.DateTimeFormat; dateTime: Intl.DateTimeFormat }
>()

export function formatCaptureTime(
  takenAt: string,
  timeZone?: string,
): PhotoCaptureTime {
  const displayTimeZone =
    timeZone ?? (takenAt.endsWith('Z') ? 'UTC' : takenAt.slice(-6))
  let formatters = captureTimeFormatters.get(displayTimeZone)

  if (!formatters) {
    formatters = {
      date: new Intl.DateTimeFormat('en', {
        timeZone: displayTimeZone,
        dateStyle: 'medium',
      }),
      dateTime: new Intl.DateTimeFormat('en', {
        timeZone: displayTimeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        timeZoneName: 'shortOffset',
      }),
    }
    captureTimeFormatters.set(displayTimeZone, formatters)
  }

  const instant = new Date(takenAt)
  const { year, month, day, hour, minute, second, timeZoneName } =
    Object.fromEntries(
      formatters.dateTime
        .formatToParts(instant)
        .map(({ type, value }) => [type, value]),
    )

  return {
    date: formatters.date.format(instant),
    dateTime: `${year}/${month}/${day} ${hour}:${minute}:${second}`,
    timeZone: timeZoneName.replace('GMT', 'UTC').replace(/^UTC[+-]0$/, 'UTC'),
  }
}
