import sharp from 'sharp'
import type { Photo } from '@/lib/photo'
import {
  createBackdropUrl,
  fetchOgPhotoSource,
  OG_PHOTO_BOUNDS,
  OG_PHOTO_STYLE,
  renderAmbientOgImage,
  toJpegDataUrl,
} from './photo'

export interface MosaicOgOptions {
  detail?: string | null
  photos: Photo[]
  stats: string[]
  title: string
}

interface MosaicCell {
  height: number
  left: number
  photo: Photo
  top: number
  width: number
}

const MOSAIC_GAP = 8
const LEAD_LAYOUT_MIN_PHOTOS = 3
const LEAD_WIDTH = 774
const SIDE_WIDTH = OG_PHOTO_BOUNDS.width - LEAD_WIDTH - MOSAIC_GAP
const SIDE_HEIGHT = (OG_PHOTO_BOUNDS.height - MOSAIC_GAP) / 2

export function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function getLeadCells(photos: Photo[]): MosaicCell[] {
  const [lead, top, bottom] = [
    ...photos.filter((photo) => photo.aspectRatio >= 1),
    ...photos.filter((photo) => photo.aspectRatio < 1),
  ]
  const sideLeft = LEAD_WIDTH + MOSAIC_GAP

  return [
    {
      photo: lead,
      left: 0,
      top: 0,
      width: LEAD_WIDTH,
      height: OG_PHOTO_BOUNDS.height,
    },
    {
      photo: top,
      left: sideLeft,
      top: 0,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    },
    {
      photo: bottom,
      left: sideLeft,
      top: SIDE_HEIGHT + MOSAIC_GAP,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    },
  ]
}

function getRowCells(photos: Photo[]): MosaicCell[] {
  const totalGap = MOSAIC_GAP * (photos.length - 1)
  const totalAspect = photos.reduce(
    (total, photo) => total + photo.aspectRatio,
    0,
  )
  const height = Math.min(
    OG_PHOTO_BOUNDS.height,
    (OG_PHOTO_BOUNDS.width - totalGap) / totalAspect,
  )
  const top = Math.round((OG_PHOTO_BOUNDS.height - height) / 2)
  let left = (OG_PHOTO_BOUNDS.width - (height * totalAspect + totalGap)) / 2

  return photos.map((photo) => {
    const width = height * photo.aspectRatio
    const cell = {
      photo,
      left: Math.round(left),
      top,
      width: Math.round(width),
      height: Math.round(height),
    }

    left += width + MOSAIC_GAP

    return cell
  })
}

function getMosaicCells(photos: Photo[]) {
  if (photos.length === 0) {
    return []
  }

  return photos.length < LEAD_LAYOUT_MIN_PHOTOS
    ? getRowCells(photos)
    : getLeadCells(photos)
}

async function getMosaicImages(cells: MosaicCell[]) {
  const sources = await Promise.all(
    cells.map(({ photo }) => fetchOgPhotoSource(photo)),
  )
  const [backdropUrl, ...photoUrls] = await Promise.all([
    sources.length > 0 ? createBackdropUrl(sources[0]) : null,
    ...cells.map(async ({ height, width }, index) => {
      const jpeg = await sharp(sources[index])
        .resize({ fit: 'cover', height, width })
        .jpeg({ mozjpeg: true, quality: 88 })
        .toBuffer()

      return toJpegDataUrl(jpeg)
    }),
  ])

  return { backdropUrl, photoUrls }
}

export async function renderMosaicOgImage({
  detail,
  photos,
  stats,
  title,
}: MosaicOgOptions) {
  const cells = getMosaicCells(photos)
  const { backdropUrl, photoUrls } = await getMosaicImages(cells)

  return renderAmbientOgImage({
    backdropUrl,
    children: cells.map(({ height, left, photo, top, width }, index) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={photo.id}
        src={photoUrls[index] ?? ''}
        alt=""
        width={width}
        height={height}
        style={{ ...OG_PHOTO_STYLE, position: 'absolute', left, top }}
      />
    )),
    detail,
    meta: stats,
    title,
  })
}
