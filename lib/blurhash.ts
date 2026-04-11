import { deflateSync } from 'node:zlib'

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

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let crc = index

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }

  return crc >>> 0
})

function crc32(buffer: Buffer) {
  let crc = 0xffffffff

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function createPngChunk(type: string, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  const crc = Buffer.alloc(4)
  const payload = Buffer.concat([typeBuffer, data])

  length.writeUInt32BE(data.length, 0)
  crc.writeUInt32BE(crc32(payload), 0)

  return Buffer.concat([length, payload, crc])
}

function encodePng(width: number, height: number, pixels: Uint8ClampedArray) {
  const header = Buffer.alloc(13)
  const rowLength = width * 4
  const raw = Buffer.alloc((rowLength + 1) * height)

  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  header[10] = 0
  header[11] = 0
  header[12] = 0

  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * rowLength
    const targetStart = y * (rowLength + 1)

    raw[targetStart] = 0
    Buffer.from(pixels.buffer, pixels.byteOffset + sourceStart, rowLength).copy(
      raw,
      targetStart + 1,
    )
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk('IHDR', header),
    createPngChunk('IDAT', deflateSync(raw)),
    createPngChunk('IEND'),
  ])
}

export function blurhashToDataUrl(hash: string, width: number, height: number) {
  const pixels = decodeBlurhash(hash, width, height)
  const png = encodePng(width, height, pixels)

  return `data:image/png;base64,${png.toString('base64')}`
}
