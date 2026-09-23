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

export async function loadPhotoBlob(
  url: string,
  mimeType: string,
  signal: AbortSignal,
  onProgress: (loadedBytes: number, totalBytes: number | null) => void,
) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

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
