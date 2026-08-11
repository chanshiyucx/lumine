const READABLE_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatReadableDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)

  return READABLE_DATE_FORMATTER.format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}
