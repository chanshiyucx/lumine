import type { PhotoCaptureTime } from '.'

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
