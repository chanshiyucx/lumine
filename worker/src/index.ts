// Serves the pipeline's private/ tree from R2.
//
// Images:   GET /<assetPath>?exp=<unix seconds>&sig=<base64url HMAC>
//           sig = HMAC-SHA256(MEDIA_SIGNING_SECRET, `${exp}:${assetPath}`)
//           where assetPath is the manifest URL, e.g. gallery/20261003-Athens/DSC08562.avif
// Manifest: GET /manifest.json with `Authorization: Bearer <PRIVATE_MANIFEST_TOKEN>`
//
// Every rejected or missing request gets the same 404 so nothing reveals which files exist.

const KEY_PREFIX = 'private/'
// Must match originals_dir and thumbnails_dir in pipeline.toml.
const ASSET_DIRS = new Set(['gallery', 'thumbnails'])
const MANIFEST_PATH = '/manifest.json'
// The web signs links until the unlock session expires (3 days); anything longer is rejected.
const MAX_LINK_TTL_SECONDS = 7 * 24 * 60 * 60
// How long a data center keeps an image after reading it from R2.
const EDGE_CACHE_SECONDS = 30 * 24 * 60 * 60

const encoder = new TextEncoder()

let signingKey: { secret: string; key: Promise<CryptoKey> } | undefined

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return notFound()
    }

    const url = new URL(request.url)

    if (url.pathname === MANIFEST_PATH) {
      return serveManifest(request, env)
    }

    return serveAsset(request, env, ctx, url)
  },
} satisfies ExportedHandler<Env>

async function serveManifest(request: Request, env: Env) {
  if (!(await isAuthorized(request, env.PRIVATE_MANIFEST_TOKEN))) {
    return notFound()
  }

  const object = await env.MEDIA_BUCKET.get(`${KEY_PREFIX}manifest.json`)

  if (!object) {
    return notFound()
  }

  return new Response(request.method === 'HEAD' ? null : object.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ETag: object.httpEtag,
    },
  })
}

async function serveAsset(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
) {
  const assetPath = parseAssetPath(url.pathname)
  const exp = Number(url.searchParams.get('exp'))
  const sig = url.searchParams.get('sig')
  const now = Math.floor(Date.now() / 1000)

  if (
    !assetPath ||
    !sig ||
    !Number.isSafeInteger(exp) ||
    exp <= now ||
    exp > now + MAX_LINK_TTL_SECONDS ||
    !(await verifySignature(
      env.MEDIA_SIGNING_SECRET,
      `${exp}:${assetPath}`,
      sig,
    ))
  ) {
    return notFound()
  }

  // Cache by path only, so every signed link to the same image shares one entry.
  const cacheKey = new Request(`${url.origin}${url.pathname}`)
  const cache = caches.default
  let response = await cache.match(cacheKey)

  if (!response) {
    const object = await env.MEDIA_BUCKET.get(`${KEY_PREFIX}${assetPath}`)

    if (!object) {
      return notFound()
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('ETag', object.httpEtag)
    headers.set('Cache-Control', `public, max-age=${EDGE_CACHE_SECONDS}`)
    response = new Response(object.body, { headers })
    ctx.waitUntil(cache.put(cacheKey, response.clone()))
  }

  const headers = new Headers(response.headers)
  // Browsers may reuse the image until its link expires; shared caches never store it.
  // A cache hit carries the edge copy's Age and Date, which browsers would subtract
  // from max-age, so the response is dated now.
  headers.delete('Age')
  headers.set('Date', new Date(now * 1000).toUTCString())
  headers.set('Cache-Control', `private, max-age=${exp - now}`)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.append('Vary', 'Origin')

  const origin = request.headers.get('Origin')
  if (origin && getAllowedOrigins(env).has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  const etag = headers.get('ETag')
  if (etag && request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers })
  }

  return new Response(request.method === 'HEAD' ? null : response.body, {
    headers,
  })
}

// Returns the manifest-relative asset path, or null for anything outside the asset directories.
function parseAssetPath(pathname: string) {
  let path: string

  try {
    path = decodeURIComponent(pathname.slice(1))
  } catch {
    return null
  }

  const segments = path.split('/')

  if (
    segments.length < 2 ||
    !ASSET_DIRS.has(segments[0]) ||
    path.includes('\\') ||
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    return null
  }

  return path
}

async function verifySignature(secret: string, message: string, sig: string) {
  const signature = decodeBase64Url(sig)

  if (!secret || !signature) {
    return false
  }

  return crypto.subtle.verify(
    'HMAC',
    await getSigningKey(secret),
    signature,
    encoder.encode(message),
  )
}

function getSigningKey(secret: string) {
  if (signingKey?.secret !== secret) {
    signingKey = {
      secret,
      key: crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
      ),
    }
  }

  return signingKey.key
}

async function isAuthorized(request: Request, token: string) {
  const header = request.headers.get('Authorization')

  if (!token || !header?.startsWith('Bearer ')) {
    return false
  }

  // Hash both sides so the comparison is constant-time regardless of length.
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest(
      'SHA-256',
      encoder.encode(header.slice('Bearer '.length)),
    ),
    crypto.subtle.digest('SHA-256', encoder.encode(token)),
  ])

  return crypto.subtle.timingSafeEqual(actual, expected)
}

function decodeBase64Url(value: string) {
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

function getAllowedOrigins(env: Env) {
  return new Set(
    env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
}

function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  })
}
