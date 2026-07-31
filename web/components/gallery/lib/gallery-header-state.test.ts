import assert from 'node:assert/strict'
import test from 'node:test'
import { getGalleryHeaderState } from './gallery-header-state'

function photo(takenAt: string, locationLabel = 'Not available') {
  return { takenAt, locationLabel }
}

test('formats one visible day and its location', () => {
  assert.deepEqual(
    getGalleryHeaderState([photo('2024-03-10T08:00:00Z', 'Berlin')]),
    {
      dateRange: 'Mar 10, 2024',
      location: 'Berlin',
    },
  )
})

test('formats a range within one month', () => {
  assert.deepEqual(
    getGalleryHeaderState([
      photo('2024-03-10', 'Berlin'),
      photo('2024-03-30', 'Hamburg'),
    ]),
    {
      dateRange: 'Mar 10 - 30, 2024',
      location: 'Berlin - Hamburg',
    },
  )
})

test('formats ranges across months and years', () => {
  assert.equal(
    getGalleryHeaderState([photo('2024-03-10'), photo('2024-04-02')]).dateRange,
    'Mar - Apr 2024',
  )
  assert.equal(
    getGalleryHeaderState([photo('2023-12-31'), photo('2024-01-01')]).dateRange,
    'Dec 2023 - Jan 2024',
  )
})

test('derives chronological endpoints from unordered photos', () => {
  assert.deepEqual(
    getGalleryHeaderState([
      photo('2024-03-20', 'Middle'),
      photo('2024-03-30', 'End'),
      photo('2024-03-10', 'Start'),
    ]),
    {
      dateRange: 'Mar 10 - 30, 2024',
      location: 'Start - End',
    },
  )
})

test('ignores invalid dates and returns an empty state without valid dates', () => {
  assert.deepEqual(
    getGalleryHeaderState([
      photo('invalid', 'Ignored'),
      photo('2024-03-10', 'Berlin'),
    ]),
    {
      dateRange: 'Mar 10, 2024',
      location: 'Berlin',
    },
  )
  assert.deepEqual(getGalleryHeaderState([photo('invalid')]), {})
})

test('omits unavailable locations and labels a missing endpoint as unknown', () => {
  assert.equal(
    getGalleryHeaderState([photo('2024-03-10'), photo('2024-03-30')]).location,
    undefined,
  )
  assert.equal(
    getGalleryHeaderState([photo('2024-03-10'), photo('2024-03-30', 'Hamburg')])
      .location,
    'Unknown - Hamburg',
  )
})
