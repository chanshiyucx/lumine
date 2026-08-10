export function isHeaderNavItemActive(
  segment: string | null,
  href: string,
) {
  return href === '/'
    ? segment === null || segment === 'photos'
    : segment === href.slice(1)
}
