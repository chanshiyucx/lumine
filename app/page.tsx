import PhotoGallery from '@/components/photo-gallery'
import { photoCollection } from '@/lib/photos'

export default function Home() {
  return <PhotoGallery {...photoCollection} />
}
