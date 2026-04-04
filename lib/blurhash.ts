const CHARACTERS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

function decode83(value: string) {
  let result = 0

  for (const character of value) {
    result = result * 83 + CHARACTERS.indexOf(character)
  }

  return result
}

function srgbToLinear(value: number) {
  const scaled = value / 255

  if (scaled <= 0.04045) {
    return scaled / 12.92
  }

  return ((scaled + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(value: number) {
  const clamped = Math.max(0, Math.min(1, value))

  if (clamped <= 0.0031308) {
    return Math.round(clamped * 12.92 * 255 + 0.5)
  }

  return Math.round((1.055 * clamped ** (1 / 2.4) - 0.055) * 255 + 0.5)
}

function signPow(value: number, exponent: number) {
  return Math.sign(value) * Math.abs(value) ** exponent
}

function decodeDc(value: number) {
  return [
    srgbToLinear(value >> 16),
    srgbToLinear((value >> 8) & 255),
    srgbToLinear(value & 255),
  ]
}

function decodeAc(value: number, maximumValue: number) {
  const quantizedRed = Math.floor(value / (19 * 19))
  const quantizedGreen = Math.floor(value / 19) % 19
  const quantizedBlue = value % 19

  return [
    signPow((quantizedRed - 9) / 9, 2) * maximumValue,
    signPow((quantizedGreen - 9) / 9, 2) * maximumValue,
    signPow((quantizedBlue - 9) / 9, 2) * maximumValue,
  ]
}

export function decodeBlurhash(hash: string, width: number, height: number) {
  if (hash.length < 6) {
    throw new Error('Invalid blurhash')
  }

  const sizeFlag = decode83(hash[0] ?? '')
  const componentX = (sizeFlag % 9) + 1
  const componentY = Math.floor(sizeFlag / 9) + 1

  if (hash.length !== 4 + 2 * componentX * componentY) {
    throw new Error('Invalid blurhash length')
  }

  const maximumValue = (decode83(hash[1] ?? '') + 1) / 166
  const colors = Array.from({ length: componentX * componentY }, (_, index) => {
    if (index === 0) {
      return decodeDc(decode83(hash.slice(2, 6)))
    }

    const value = decode83(hash.slice(4 + index * 2, 6 + index * 2))
    return decodeAc(value, maximumValue)
  })

  const pixels = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0
      let green = 0
      let blue = 0

      for (let cy = 0; cy < componentY; cy += 1) {
        for (let cx = 0; cx < componentX; cx += 1) {
          const basis =
            Math.cos((Math.PI * x * cx) / width) *
            Math.cos((Math.PI * y * cy) / height)
          const color = colors[cx + cy * componentX]

          red += color[0] * basis
          green += color[1] * basis
          blue += color[2] * basis
        }
      }

      const index = 4 * (x + y * width)
      pixels[index] = linearToSrgb(red)
      pixels[index + 1] = linearToSrgb(green)
      pixels[index + 2] = linearToSrgb(blue)
      pixels[index + 3] = 255
    }
  }

  return pixels
}

export function blurhashToDataUrl(hash: string, width: number, height: number) {
  const pixels = decodeBlurhash(hash, width, height)
  const rects: string[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = 4 * (x + y * width)
      const red = pixels[index]
      const green = pixels[index + 1]
      const blue = pixels[index + 2]

      rects.push(
        `<rect x="${x}" y="${y}" width="1" height="1" fill="rgb(${red},${green},${blue})" />`,
      )
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><filter id="b"><feGaussianBlur stdDeviation="0.65" /></filter></defs><g filter="url(#b)">${rects.join('')}</g></svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
