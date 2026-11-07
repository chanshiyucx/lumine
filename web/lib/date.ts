const READABLE_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatReadableDate(value: string) {
  // Date-only ISO strings parse as UTC, matching the formatter.
  return READABLE_DATE_FORMATTER.format(new Date(value))
}
