const DEFAULT_MAX_CACHED_PHOTOS = 3

export interface PhotoResourceSource {
  bytes: number
  mime: string
  url: string
}

interface PhotoResourceProgress {
  loadedBytes: number
  progress: number
  totalBytes: number
}

export type PhotoResourceState =
  | { status: 'idle' }
  | ({ status: 'loading' } & PhotoResourceProgress)
  | ({ src: string; status: 'decoding' } & PhotoResourceProgress)
  | { src: string; status: 'cached' }
  | { src: string; status: 'ready' }
  | { message: string; status: 'error' }

export interface PhotoResourceStoreRuntime {
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void
  createObjectUrl: (blob: Blob) => string
  fetch: (url: string, init: RequestInit) => Promise<Response>
  revokeObjectUrl: (url: string) => void
  setTimer: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>
}

export interface PhotoResourceStoreOptions {
  maxCachedPhotos?: number
  runtime?: PhotoResourceStoreRuntime
}

interface ResourceEntry {
  activeCount: number
  controller: AbortController | null
  loadTimer: ReturnType<typeof setTimeout> | null
  objectUrl: string | null
  operationId: number
  source: PhotoResourceSource
  state: PhotoResourceState
}

const IDLE_STATE: PhotoResourceState = { status: 'idle' }

const browserRuntime: PhotoResourceStoreRuntime = {
  clearTimer: (timer) => clearTimeout(timer),
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  fetch: (url, init) => fetch(url, init),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
}

function getChunkBlobPart(chunk: Uint8Array): BlobPart {
  const { buffer, byteLength, byteOffset } = chunk

  if (buffer instanceof ArrayBuffer) {
    if (byteOffset === 0 && byteLength === buffer.byteLength) {
      return buffer
    }

    return buffer.slice(byteOffset, byteOffset + byteLength)
  }

  return chunk.slice() as Uint8Array<ArrayBuffer>
}

async function readResponseAsBlob(
  response: Response,
  signal: AbortSignal,
  mimeType: string,
  onProgress: (loadedBytes: number, totalBytes: number | null) => void,
) {
  const headerBytes = Number(response.headers.get('content-length') ?? '')
  const totalBytes =
    Number.isFinite(headerBytes) && headerBytes > 0 ? headerBytes : null

  if (!response.body) {
    const blob = await response.blob()
    onProgress(blob.size, totalBytes ?? blob.size)
    return blob
  }

  const reader = response.body.getReader()
  const chunks: BlobPart[] = []
  let loadedBytes = 0

  try {
    while (true) {
      if (signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }

      const { done, value } = await reader.read()

      if (done) {
        break
      }

      if (!value) {
        continue
      }

      chunks.push(getChunkBlobPart(value))
      loadedBytes += value.byteLength
      onProgress(loadedBytes, totalBytes)
    }
  } finally {
    reader.releaseLock()
  }

  return new Blob(chunks, {
    type: response.headers.get('content-type') ?? mimeType,
  })
}

function assertSuccessfulResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
}

function getProgress(
  loadedBytes: number,
  totalBytes: number,
): PhotoResourceProgress {
  return {
    loadedBytes,
    progress:
      totalBytes > 0 ? Math.min(100, (loadedBytes / totalBytes) * 100) : 0,
    totalBytes,
  }
}

export function getIdlePhotoResourceState() {
  return IDLE_STATE
}

export class PhotoResourceStore {
  readonly #cachedKeys = new Map<string, true>()
  readonly #entries = new Map<string, ResourceEntry>()
  readonly #listeners = new Map<string, Set<() => void>>()
  readonly #maxCachedPhotos: number
  readonly #runtime: PhotoResourceStoreRuntime

  constructor({
    maxCachedPhotos = DEFAULT_MAX_CACHED_PHOTOS,
    runtime = browserRuntime,
  }: PhotoResourceStoreOptions = {}) {
    this.#maxCachedPhotos = Math.max(1, maxCachedPhotos)
    this.#runtime = runtime
  }

  getSnapshot(key: string) {
    return this.#entries.get(key)?.state ?? IDLE_STATE
  }

  subscribe(key: string, listener: () => void) {
    const listeners = this.#listeners.get(key) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(key, listeners)

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.#listeners.delete(key)
      }
    }
  }

  activate(source: PhotoResourceSource, loadDelayMs = 0) {
    const entry = this.#getOrCreateEntry(source)
    entry.activeCount += 1

    if (entry.objectUrl) {
      this.#touchCachedEntry(source.url)
    } else if (!entry.controller && entry.loadTimer === null) {
      this.#startLoad(entry, loadDelayMs)
    }

    let isReleased = false

    return () => {
      if (isReleased) {
        return
      }

      isReleased = true
      this.#release(entry)
    }
  }

  markDecoded(key: string, src: string) {
    const entry = this.#entries.get(key)
    if (
      !entry ||
      entry.activeCount === 0 ||
      entry.objectUrl !== src ||
      (entry.state.status !== 'cached' && entry.state.status !== 'decoding')
    ) {
      return
    }

    this.#setState(entry, { src, status: 'ready' })
  }

  markRenderFailed(key: string, src: string, message: string) {
    const entry = this.#entries.get(key)
    if (!entry || entry.activeCount === 0 || entry.objectUrl !== src) {
      return
    }

    this.#cachedKeys.delete(key)
    entry.objectUrl = null
    this.#setState(entry, { message, status: 'error' })
    this.#runtime.revokeObjectUrl(src)
  }

  #emit(key: string) {
    this.#listeners.get(key)?.forEach((listener) => listener())
  }

  #evictIfNeeded() {
    while (this.#cachedKeys.size > this.#maxCachedPhotos) {
      let evicted = false

      for (const key of this.#cachedKeys.keys()) {
        const entry = this.#entries.get(key)
        if (!entry) {
          this.#cachedKeys.delete(key)
          evicted = true
          break
        }

        if (entry.activeCount > 0) {
          continue
        }

        const objectUrl = entry.objectUrl
        this.#cachedKeys.delete(key)
        this.#entries.delete(key)
        this.#emit(key)

        if (objectUrl) {
          this.#runtime.revokeObjectUrl(objectUrl)
        }

        evicted = true
        break
      }

      if (!evicted) {
        return
      }
    }
  }

  #getOrCreateEntry(source: PhotoResourceSource) {
    const existingEntry = this.#entries.get(source.url)
    if (existingEntry) {
      existingEntry.source = source
      return existingEntry
    }

    const entry: ResourceEntry = {
      activeCount: 0,
      controller: null,
      loadTimer: null,
      objectUrl: null,
      operationId: 0,
      source,
      state: IDLE_STATE,
    }
    this.#entries.set(source.url, entry)
    return entry
  }

  #isCurrentOperation(
    entry: ResourceEntry,
    operationId: number,
    controller: AbortController,
  ) {
    return (
      entry.operationId === operationId &&
      entry.controller === controller &&
      !controller.signal.aborted
    )
  }

  async #load(
    entry: ResourceEntry,
    operationId: number,
    controller: AbortController,
  ) {
    try {
      const response = await this.#runtime.fetch(entry.source.url, {
        signal: controller.signal,
      })
      assertSuccessfulResponse(response)

      const blob = await readResponseAsBlob(
        response,
        controller.signal,
        entry.source.mime,
        (loadedBytes, responseBytes) => {
          if (!this.#isCurrentOperation(entry, operationId, controller)) {
            return
          }

          const totalBytes = responseBytes ?? entry.source.bytes
          const progress = getProgress(loadedBytes, totalBytes)
          const previousProgress =
            entry.state.status === 'loading' ? entry.state.progress : -1

          if (Math.floor(previousProgress) !== Math.floor(progress.progress)) {
            this.#setState(entry, { ...progress, status: 'loading' })
          }
        },
      )

      if (!this.#isCurrentOperation(entry, operationId, controller)) {
        return
      }

      entry.controller = null
      const objectUrl = this.#runtime.createObjectUrl(blob)
      entry.objectUrl = objectUrl
      this.#touchCachedEntry(entry.source.url)
      this.#setState(entry, {
        ...getProgress(blob.size, blob.size),
        src: objectUrl,
        status: 'decoding',
      })
      this.#evictIfNeeded()
    } catch {
      if (!this.#isCurrentOperation(entry, operationId, controller)) {
        return
      }

      entry.controller = null
      this.#setState(entry, {
        message: 'Failed to load image',
        status: 'error',
      })
    }
  }

  #release(entry: ResourceEntry) {
    entry.activeCount = Math.max(0, entry.activeCount - 1)
    if (entry.activeCount > 0) {
      return
    }

    if (entry.loadTimer !== null || entry.controller) {
      this.#stopLoad(entry)
    }

    if (entry.objectUrl) {
      if (entry.state.status !== 'cached') {
        this.#setState(entry, {
          src: entry.objectUrl,
          status: 'cached',
        })
      }
      this.#evictIfNeeded()
      return
    }

    this.#entries.delete(entry.source.url)
    this.#emit(entry.source.url)
  }

  #setState(entry: ResourceEntry, state: PhotoResourceState) {
    entry.state = state
    this.#emit(entry.source.url)
  }

  #startLoad(entry: ResourceEntry, loadDelayMs: number) {
    const controller = new AbortController()
    const operationId = entry.operationId + 1
    entry.operationId = operationId
    entry.controller = controller
    this.#setState(entry, {
      ...getProgress(0, entry.source.bytes),
      status: 'loading',
    })

    entry.loadTimer = this.#runtime.setTimer(() => {
      entry.loadTimer = null
      void this.#load(entry, operationId, controller)
    }, loadDelayMs)
  }

  #stopLoad(entry: ResourceEntry) {
    entry.operationId += 1

    if (entry.loadTimer !== null) {
      this.#runtime.clearTimer(entry.loadTimer)
      entry.loadTimer = null
    }

    entry.controller?.abort()
    entry.controller = null
  }

  #touchCachedEntry(key: string) {
    this.#cachedKeys.delete(key)
    this.#cachedKeys.set(key, true)
  }
}

export const photoResourceStore = new PhotoResourceStore()
