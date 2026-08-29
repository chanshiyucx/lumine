import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import type { Photo } from '@/lib/photo'
import { OG_CACHE_CONTROL, OG_IMAGE_SIZE } from './config'

export interface StatItem {
  label?: string
  value: string | number
}

export interface MosaicOgOptions {
  description?: string | null
  photos: Photo[]
  stats: StatItem[]
  tag?: string | null
  title: string
}

const THEME = {
  accent: '#c4a7e7',
  base: '#191724',
  surface: '#232136',
  text: '#e0def4',
}

const MOSAIC_PHOTO_COUNT = 6

async function getMosaicPhotoUrls(photos: Photo[]) {
  if (photos.length === 0) {
    return []
  }

  const photoUrls = await Promise.all(
    photos.slice(0, MOSAIC_PHOTO_COUNT).map(async (photo) => {
      const response = await fetch(photo.thumbnail.url, { cache: 'no-store' })

      if (!response.ok) {
        throw new Error(
          `Failed to fetch OG photo (${response.status} ${response.statusText})`,
        )
      }

      const jpeg = await sharp(await response.arrayBuffer())
        .resize({
          fit: 'cover',
          height: 330,
          width: 440,
        })
        .jpeg({ mozjpeg: true, quality: 80 })
        .toBuffer()

      return `data:image/jpeg;base64,${jpeg.toString('base64')}`
    }),
  )

  return Array.from(
    { length: MOSAIC_PHOTO_COUNT },
    (_, index) => photoUrls[index % photoUrls.length],
  )
}

export async function renderMosaicOgImage({
  description,
  photos,
  stats,
  tag,
  title,
}: MosaicOgOptions): Promise<Response> {
  const photoUrls = await getMosaicPhotoUrls(photos)
  const rows = [photoUrls.slice(0, 3), photoUrls.slice(3, 6)]

  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: THEME.base,
        color: THEME.text,
        display: 'flex',
        fontFamily: 'sans-serif',
        height: '100%',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      {photoUrls.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            height: 628,
            left: 0,
            opacity: 0.85,
            padding: 0,
            position: 'absolute',
            top: 0,
            width: 1200,
          }}
        >
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 6,
                height: 311,
                width: 1200,
              }}
            >
              {row.map((url, imageIndex) => (
                <div
                  key={`${rowIndex}-${imageIndex}`}
                  style={{
                    backgroundColor: THEME.surface,
                    display: 'flex',
                    height: 311,
                    overflow: 'hidden',
                    position: 'relative',
                    width: 396,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    style={{
                      height: 311,
                      objectFit: 'cover',
                      width: 396,
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(25,23,36,0.35) 0%, rgba(25,23,36,0.78) 100%), linear-gradient(180deg, rgba(25,23,36,0.2) 0%, rgba(25,23,36,0.68) 100%)',
          display: 'flex',
          height: 628,
          left: 0,
          position: 'absolute',
          top: 0,
          width: 1200,
        }}
      />

      <div
        style={{
          background:
            'linear-gradient(90deg, rgba(224,222,244,0.1) 1px, transparent 1px), linear-gradient(0deg, rgba(224,222,244,0.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          display: 'flex',
          height: 628,
          left: 0,
          opacity: 0.06,
          position: 'absolute',
          top: 0,
          width: 1200,
        }}
      />

      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          justifyContent: 'center',
          maxWidth: 900,
          position: 'relative',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <h1
          style={{
            color: THEME.text,
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: '-1px',
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          {title}
        </h1>

        {tag && (
          <div
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(57,53,82,0.72)',
              border: '1px solid rgba(196,167,231,0.3)',
              borderRadius: 16,
              color: 'rgba(224,222,244,0.9)',
              display: 'flex',
              fontSize: 14,
              letterSpacing: '0.3px',
              padding: '4px 14px',
            }}
          >
            #{tag}
          </div>
        )}

        {description && (
          <p
            style={{
              color: 'rgba(224, 222, 244, 0.75)',
              fontSize: 20,
              letterSpacing: '0.2px',
              margin: 0,
            }}
          >
            {description}
          </p>
        )}

        {stats.length > 0 && (
          <div
            style={{
              alignItems: 'center',
              color: 'rgba(224, 222, 244, 0.85)',
              display: 'flex',
              gap: 24,
              marginTop: 6,
            }}
          >
            {stats.map((stat, index) => (
              <div
                key={index}
                style={{ alignItems: 'center', display: 'flex', gap: 6 }}
              >
                {stat.label && (
                  <span
                    style={{
                      color: 'rgba(144,140,170,0.75)',
                      fontSize: 12,
                      letterSpacing: '0.3px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {stat.label}
                  </span>
                )}
                <span style={{ fontSize: 16 }}>{stat.value}</span>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            background: THEME.accent,
            borderRadius: 2,
            display: 'flex',
            height: 3,
            marginTop: 8,
            width: 80,
          }}
        />
      </div>
    </div>,
    {
      ...OG_IMAGE_SIZE,
      headers: {
        'Cache-Control': OG_CACHE_CONTROL,
      },
    },
  )
}
