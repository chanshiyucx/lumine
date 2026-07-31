import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PhotoMasonry } from './photo-masonry'

test('renders an explicit empty state without browser APIs', () => {
  const markup = renderToStaticMarkup(
    createElement(PhotoMasonry, {
      photos: [],
      onPhotoOpen: () => {},
      onVisiblePhotosChange: () => {},
    }),
  )

  assert.match(markup, /role="status"/)
  assert.match(markup, /No photos available\./)
})
