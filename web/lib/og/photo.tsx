import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import type { CSSProperties, ReactNode } from 'react'
import sharp from 'sharp'
import { fitWithinBounds } from '@/lib/math'
import type { Photo } from '@/lib/photo'
import {
  formatExposureTime,
  formatFNumber,
  formatFocalLength,
  formatIsoValue,
} from '@/lib/photo/formatters'
import { OG_CACHE_CONTROL, OG_IMAGE_SIZE } from './config'

interface AmbientOgImageOptions {
  backdropUrl: string | null
  children: ReactNode
  detail?: string | null
  meta: string[]
  title: string
}

const CANVAS = OG_IMAGE_SIZE
const PADDING = 28
const CAPTION_INSET = 40
const CAPTION_HEIGHT = 84
const CAPTION_SHADE_HEIGHT = 168
const TITLE_MAX_WIDTH = 360
const BACKDROP_BLUR_SIGMA = 48
const BACKDROP_BRIGHTNESS = 0.46
const BACKDROP_SATURATION = 1.8
const THEME = {
  base: '#232136',
  scrim: 'rgba(35,33,54,0.12)',
  text: '#e0def4',
}
const geistMedium = await readFile(
  join(process.cwd(), 'assets/fonts/Geist-Medium.ttf'),
)

export const OG_PHOTO_BOUNDS = {
  width: CANVAS.width - PADDING * 2,
  height: CANVAS.height - PADDING - CAPTION_HEIGHT,
}

export const OG_PHOTO_STYLE: CSSProperties = {
  borderRadius: 12,
  boxShadow:
    '0 24px 48px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(224,222,244,0.08)',
}

function getExifItems(photo: Photo) {
  const { camera } = photo
  const focalLength = camera.focalLengthIn35mmFilm ?? camera.focalLength
  const items: string[] = []

  if (focalLength) items.push(formatFocalLength(focalLength))
  if (camera.fNumber) items.push(formatFNumber(camera.fNumber))
  if (camera.exposureTime) items.push(formatExposureTime(camera.exposureTime))
  if (camera.iso) items.push(formatIsoValue(camera.iso))

  return items
}

export function toJpegDataUrl(jpeg: Buffer) {
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

export async function fetchOgPhotoSource(photo: Photo) {
  const response = await fetch(photo.thumbnail.url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OG photo (${response.status} ${response.statusText})`,
    )
  }

  return response.arrayBuffer()
}

export async function createBackdropUrl(source: ArrayBuffer) {
  const jpeg = await sharp(source)
    .resize({ fit: 'cover', height: CANVAS.height, width: CANVAS.width })
    .blur(BACKDROP_BLUR_SIGMA)
    .modulate({ saturation: BACKDROP_SATURATION })
    .linear(BACKDROP_BRIGHTNESS, 0)
    .jpeg({ quality: 80 })
    .toBuffer()

  return toJpegDataUrl(jpeg)
}

export function renderAmbientOgImage({
  backdropUrl,
  children,
  detail,
  meta,
  title,
}: AmbientOgImageOptions) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: THEME.base,
        color: THEME.text,
        fontFamily: 'Geist',
        fontWeight: 500,
        display: 'flex',
      }}
    >
      {backdropUrl && (
        <>
          {/* ImageResponse renders native image elements into the generated PNG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdropUrl}
            alt=""
            width={CANVAS.width}
            height={CANVAS.height}
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: CANVAS.width,
              height: CANVAS.height,
              backgroundColor: THEME.scrim,
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: CANVAS.width,
              height: CAPTION_SHADE_HEIGHT,
              backgroundImage:
                'linear-gradient(to top, rgba(0,0,0,0.32), rgba(0,0,0,0))',
              display: 'flex',
            }}
          />
        </>
      )}

      <div
        style={{
          position: 'absolute',
          top: PADDING,
          left: PADDING,
          width: OG_PHOTO_BOUNDS.width,
          height: OG_PHOTO_BOUNDS.height,
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex',
        }}
      >
        {children}
      </div>

      <div
        style={{
          position: 'absolute',
          left: CAPTION_INSET,
          right: CAPTION_INSET,
          bottom: 0,
          height: CAPTION_HEIGHT,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          fontSize: 28,
          whiteSpace: 'nowrap',
          display: 'flex',
        }}
      >
        <div style={{ alignItems: 'baseline', gap: 16, display: 'flex' }}>
          <span
            style={{
              maxWidth: TITLE_MAX_WIDTH,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </span>
          {detail && <span>{detail}</span>}
        </div>
        {meta.length > 0 && (
          <div style={{ gap: 12, display: 'flex' }}>
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}
      </div>
    </div>,
    {
      ...CANVAS,
      fonts: [
        { name: 'Geist', data: geistMedium, style: 'normal', weight: 500 },
      ],
      headers: {
        'Cache-Control': OG_CACHE_CONTROL,
      },
    },
  )
}

export async function renderPhotoOgImage(photo: Photo) {
  const photoSize = fitWithinBounds(photo.aspectRatio, OG_PHOTO_BOUNDS)
  const source = await fetchOgPhotoSource(photo)
  const [photoJpeg, backdropUrl] = await Promise.all([
    sharp(source)
      .resize({
        fit: 'inside',
        height: 1000,
        width: 1400,
        withoutEnlargement: true,
      })
      .jpeg({ mozjpeg: true, quality: 88 })
      .toBuffer(),
    createBackdropUrl(source),
  ])

  return renderAmbientOgImage({
    backdropUrl,
    children: (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={toJpegDataUrl(photoJpeg)}
        alt=""
        width={photoSize.width}
        height={photoSize.height}
        style={OG_PHOTO_STYLE}
      />
    ),
    detail: photo.captureTime.date,
    meta: getExifItems(photo),
    title: photo.album.title,
  })
}
