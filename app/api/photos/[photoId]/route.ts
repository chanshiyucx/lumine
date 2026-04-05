import { getPhotoBySlug } from '@/lib/photos'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  context: RouteContext<'/api/photos/[photoId]'>,
) {
  const { photoId } = await context.params
  const photo = getPhotoBySlug(photoId)

  if (!photo) {
    return new Response('Photo not found', { status: 404 })
  }

  const upstream = await fetch(photo.original.url, {
    cache: 'force-cache',
  }).catch(() => null)

  if (!upstream?.ok) {
    return new Response('Unable to load photo asset', { status: 502 })
  }

  const headers = new Headers()

  headers.set(
    'content-type',
    upstream.headers.get('content-type') ?? photo.original.mime,
  )
  headers.set(
    'content-length',
    upstream.headers.get('content-length') ?? String(photo.original.bytes),
  )
  headers.set('cache-control', 'public, max-age=31536000, immutable')

  return new Response(upstream.body, {
    status: 200,
    headers,
  })
}
