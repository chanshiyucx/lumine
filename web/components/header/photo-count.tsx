import { getPhotoCollection } from '@/lib/photo/collection'
import { PhotoCountLabel } from './photo-count-label'

export async function PhotoCount() {
  const { photos } = await getPhotoCollection()

  return <PhotoCountLabel publicCount={photos.length} />
}
