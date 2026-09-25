import { getPhotoCollection } from '@/lib/photo/collection'

export async function PhotoCount() {
  const { photos } = await getPhotoCollection()
  const title = `${photos.length} photos`

  return (
    <span
      className="text-subtle min-w-[3ch] text-xs font-semibold tabular-nums lg:text-sm"
      aria-label={title}
      title={title}
    >
      {photos.length}
    </span>
  )
}
