const BYTES_PER_MEBIBYTE = 1024 * 1024

export function formatLoadingBytes(bytes: number) {
  return `${(bytes / BYTES_PER_MEBIBYTE).toFixed(1)} MB`
}
