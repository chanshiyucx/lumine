import { z } from 'zod'

async function parseJsonResponse<T>(
  response: Response,
  url: string,
  schema: z.ZodType<T>,
) {
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url} (${response.status} ${response.statusText})`,
    )
  }

  let json: unknown

  try {
    json = await response.json()
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${url}: ${String(error)}`)
  }

  const result = schema.safeParse(json)

  if (!result.success) {
    throw new Error(
      `Invalid JSON from ${url}:\n${z.prettifyError(result.error)}`,
    )
  }

  return result.data
}

export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
) {
  return parseJsonResponse(await fetch(url, init), url, schema)
}

/** Like fetchJson, but a 404 means the resource is absent, not broken. */
export async function fetchOptionalJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
) {
  const response = await fetch(url, init)

  if (response.status === 404) {
    return null
  }

  return parseJsonResponse(response, url, schema)
}
