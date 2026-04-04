import { PhotoGallery } from '@/components/photo/photo-gallery'
import { photoCollection } from '@/lib/photos'

export default function Page() {
  return <PhotoGallery {...photoCollection} />
}
