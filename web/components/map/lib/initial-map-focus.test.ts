import assert from 'node:assert/strict'
import test from 'node:test'
import { getInitialFocusItems } from './initial-map-focus'

interface TestItem {
  key: string
  location: {
    lat: number
    lng: number
  }
}

const EUROPE = { lat: 46.16, lng: 10.63 }
const CHANGSHA = { lat: 28.23, lng: 112.94 }

function makeItems(
  prefix: string,
  location: TestItem['location'],
  count: number,
): TestItem[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${prefix}-${index}`,
    location,
  }))
}

test('focuses a clearly dominant album region', () => {
  const items = [
    ...makeItems('europe', EUROPE, 20),
    ...makeItems('changsha', CHANGSHA, 1),
  ]

  const focusedItems = getInitialFocusItems(items)

  assert.equal(focusedItems.length, 20)
  assert.equal(
    focusedItems.every((item) => item.key.startsWith('europe-')),
    true,
  )
})

test('shows every region when no cluster is dominant', () => {
  const items = [
    ...makeItems('europe', EUROPE, 10),
    ...makeItems('changsha', CHANGSHA, 10),
  ]

  assert.equal(getInitialFocusItems(items).length, items.length)
})

test('does not focus a tiny cluster', () => {
  const items = [
    ...makeItems('europe', EUROPE, 2),
    ...makeItems('changsha', CHANGSHA, 1),
  ]

  assert.equal(getInitialFocusItems(items).length, items.length)
})
