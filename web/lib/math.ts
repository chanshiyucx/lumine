export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function fitWithinBounds(
  aspectRatio: number,
  bounds: { height: number; width: number },
) {
  let width = bounds.width
  let height = width / aspectRatio

  if (height > bounds.height) {
    height = bounds.height
    width = height * aspectRatio
  }

  return { width, height }
}
