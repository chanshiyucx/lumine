export function isHeaderNavItemActive(pathname: string, href: string) {
  const normalizedPathname = pathname || '/'

  return href === '/'
    ? normalizedPathname === '/' || normalizedPathname.startsWith('/photos/')
    : normalizedPathname.startsWith(href)
}
