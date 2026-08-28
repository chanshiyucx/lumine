import { ImageResponse } from 'next/og'
import type { ReactNode } from 'react'
import sharp from 'sharp'
import { getAlbumDescriptor } from '@/lib/albums'
import type { Photo } from '@/lib/photo'
import { siteConfig } from '@/lib/site-config'
import { OG_CACHE_CONTROL, OG_IMAGE_SIZE } from './config'
import { formatCameraLabel } from './metadata'

interface LayoutConfig {
  arrangement: 'split' | 'stack' | 'wide'
  padding: number
  gap: number
  photoBox: { maxWidth: number; maxHeight: number }
  infoCompact: boolean
  photoFit: 'cover' | 'contain'
}

interface LayoutPieces {
  gap: number
  photo: ReactNode
  info: ReactNode
  photoWidth: number
}

interface InfoPanelProps {
  title: string
  tags: string[]
  exifItems: Array<{ label: string; text: string }>
  camera: string | null
  formattedDate: string
  compact: boolean
}

const CANVAS = OG_IMAGE_SIZE
const OG_ASPECT_RATIO = CANVAS.width / CANVAS.height
const THEME = {
  accent: '#c4a7e7',
  base: '#191724',
  surface: '#232136',
  overlay: '#2a273f',
  text: '#e0def4',
}

function formatPhotoDate(takenAt: string) {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(takenAt))
}

function getExifItems(photo: Photo) {
  const items: Array<{ label: string; text: string }> = []

  if (photo.camera.aperture) {
    items.push({ label: 'f', text: `/${photo.camera.aperture}` })
  }
  if (photo.camera.shutter) {
    items.push({ label: 's', text: photo.camera.shutter })
  }
  if (photo.camera.iso) {
    items.push({ label: 'iso', text: `${photo.camera.iso}` })
  }

  const focalLength =
    photo.camera.focalLengthIn35mm ?? photo.camera.focalLengthMm

  if (focalLength) {
    items.push({ label: 'mm', text: `${focalLength} mm` })
  }

  return items
}

function determineLayout(aspect: number): LayoutConfig {
  const resolvedAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1

  if (resolvedAspect < 0.9) {
    const padding = 60

    return {
      arrangement: 'split',
      padding,
      gap: 44,
      photoBox: {
        maxWidth: CANVAS.width * 0.44,
        maxHeight: CANVAS.height - padding * 2,
      },
      infoCompact: false,
      photoFit: 'cover',
    }
  }

  if (resolvedAspect <= 1.1) {
    const padding = 60

    return {
      arrangement: 'split',
      padding,
      gap: 44,
      photoBox: {
        maxWidth: CANVAS.width * 0.5,
        maxHeight: CANVAS.height - padding * 2,
      },
      infoCompact: false,
      photoFit: 'cover',
    }
  }

  if (resolvedAspect >= 2.35) {
    const padding = 50

    return {
      arrangement: 'wide',
      padding,
      gap: 28,
      photoBox: {
        maxWidth: CANVAS.width - padding * 2,
        maxHeight: 340,
      },
      infoCompact: true,
      photoFit: 'contain',
    }
  }

  const padding = 54

  return {
    arrangement: resolvedAspect / OG_ASPECT_RATIO <= 0.82 ? 'split' : 'stack',
    padding,
    gap: 26,
    photoBox: {
      maxWidth: CANVAS.width - padding * 2,
      maxHeight: 410,
    },
    infoCompact: false,
    photoFit: 'cover',
  }
}

function fitWithinBox(
  aspect: number,
  { maxWidth, maxHeight }: LayoutConfig['photoBox'],
) {
  let width = maxWidth
  let height = width / aspect

  if (height > maxHeight) {
    height = maxHeight
    width = height * aspect
  }

  return { width, height }
}

async function getRenderablePhotoUrl(photo: Photo) {
  const response = await fetch(photo.thumbnail.url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OG photo (${response.status} ${response.statusText})`,
    )
  }

  const jpeg = await sharp(await response.arrayBuffer())
    .resize({
      fit: 'inside',
      height: 1000,
      width: 1400,
      withoutEnlargement: true,
    })
    .jpeg({ mozjpeg: true, quality: 88 })
    .toBuffer()

  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

function PhotoFrame({
  width,
  height,
  fit,
  src,
}: {
  width: number
  height: number
  fit: 'cover' | 'contain'
  src: string
}) {
  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow:
          '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(224,222,244,0.05)',
        backgroundColor: THEME.base,
        display: 'flex',
      }}
    >
      {/* ImageResponse renders native image elements into the generated PNG. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          borderRadius: 12,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(135deg, rgba(224,222,244,0.08) 0%, transparent 50%)',
          display: 'flex',
        }}
      />
    </div>
  )
}

function InfoPanel({
  title,
  tags,
  exifItems,
  camera,
  formattedDate,
  compact,
}: InfoPanelProps) {
  const fontScale = compact ? 0.85 : 1.08

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 12 : 16,
        color: THEME.text,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: compact ? 28 : 38,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          lineHeight: 1.25,
        }}
      >
        {title}
      </h1>

      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tags.slice(0, compact ? 2 : 3).map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 13 * fontScale,
                color: 'rgba(224,222,244,0.9)',
                backgroundColor: 'rgba(57,53,82,0.72)',
                padding: `${compact ? 4 : 6}px ${compact ? 12 : 14}px`,
                borderRadius: 16,
                border: '1px solid rgba(196,167,231,0.3)',
                letterSpacing: '0.2px',
              }}
            >
              #{tag}
            </div>
          ))}
        </div>
      )}

      {camera && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'rgba(224,222,244,0.7)',
            fontSize: 15 * fontScale,
          }}
        >
          <span
            style={{
              fontSize: 11 * fontScale,
              color: 'rgba(144,140,170,0.75)',
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            }}
          >
            cam
          </span>
          <span>{camera}</span>
        </div>
      )}

      {exifItems.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: compact ? 12 : 18,
            color: 'rgba(224,222,244,0.75)',
            fontSize: 14 * fontScale,
            flexWrap: 'wrap',
          }}
        >
          {exifItems.map((item) => (
            <div
              key={`${item.label}-${item.text}`}
              style={{ display: 'flex', gap: 4, alignItems: 'center' }}
            >
              <span
                style={{
                  fontSize: 10 * fontScale,
                  color: 'rgba(144,140,170,0.68)',
                  letterSpacing: '0.2px',
                  textTransform: 'uppercase',
                }}
              >
                {item.label}
              </span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          color: 'rgba(144,140,170,0.9)',
          fontSize: 13 * fontScale,
          marginTop: compact ? 2 : 6,
          display: 'flex',
        }}
      >
        {formattedDate}
      </div>

      <div
        style={{
          width: compact ? 50 : 80,
          height: 3,
          background: THEME.accent,
          borderRadius: 2,
          display: 'flex',
        }}
      />
    </div>
  )
}

function SplitLayout({ gap, photo, info }: LayoutPieces) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap,
        width: '100%',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', flexShrink: 0 }}>{photo}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          height: '100%',
        }}
      >
        {info}
      </div>
    </div>
  )
}

function StackLayout({ gap, photo, info, photoWidth }: LayoutPieces) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        width: '100%',
        height: '100%',
        justifyContent: 'flex-start',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        {photo}
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: photoWidth,
          display: 'flex',
          flexShrink: 0,
        }}
      >
        {info}
      </div>
    </div>
  )
}

function WideLayout({ gap, photo, info, photoWidth }: LayoutPieces) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        width: '100%',
        height: '100%',
        justifyContent: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        {photo}
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: photoWidth,
          margin: '0 auto',
          display: 'flex',
          flexShrink: 0,
        }}
      >
        {info}
      </div>
    </div>
  )
}

export async function renderPhotoOgImage(photo: Photo) {
  const album = getAlbumDescriptor(photo.albumKey)
  const layout = determineLayout(photo.aspectRatio)
  const photoSize = fitWithinBox(photo.aspectRatio, layout.photoBox)
  const renderablePhotoUrl = await getRenderablePhotoUrl(photo)
  const photoFrame = (
    <PhotoFrame
      width={photoSize.width}
      height={photoSize.height}
      fit={layout.photoFit}
      src={renderablePhotoUrl}
    />
  )
  const infoPanel = (
    <InfoPanel
      title={photo.title}
      tags={[album.title]}
      exifItems={getExifItems(photo)}
      camera={formatCameraLabel(photo)}
      formattedDate={formatPhotoDate(photo.takenAt)}
      compact={layout.infoCompact}
    />
  )
  const layoutProps: LayoutPieces = {
    gap: layout.gap,
    photo: photoFrame,
    info: infoPanel,
    photoWidth: photoSize.width,
  }
  const content =
    layout.arrangement === 'wide' ? (
      <WideLayout {...layoutProps} />
    ) : layout.arrangement === 'stack' ? (
      <StackLayout {...layoutProps} />
    ) : (
      <SplitLayout {...layoutProps} />
    )

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: layout.padding,
        position: 'relative',
        overflow: 'hidden',
        background: `radial-gradient(circle at 100% 100%, ${THEME.base} 0%, transparent 52%), linear-gradient(135deg, ${THEME.base} 0%, ${THEME.surface} 52%, ${THEME.overlay} 100%)`,
        color: THEME.text,
        fontFamily: 'sans-serif',
        display: 'flex',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          background:
            'linear-gradient(90deg, rgba(224,222,244,0.1) 1px, transparent 1px), linear-gradient(0deg, rgba(224,222,244,0.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          right: 32,
          fontSize: 20,
          fontWeight: 500,
          color: 'rgba(224,222,244,0.68)',
          letterSpacing: '0.5px',
          display: 'flex',
        }}
      >
        {siteConfig.author} · {siteConfig.name}
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
        }}
      >
        {content}
      </div>
    </div>,
    {
      ...CANVAS,
      headers: {
        'Cache-Control': OG_CACHE_CONTROL,
      },
    },
  )
}
