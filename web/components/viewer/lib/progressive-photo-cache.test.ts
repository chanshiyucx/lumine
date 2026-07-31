import assert from 'node:assert/strict'
import test from 'node:test'
import { ObjectUrlLruCache } from './progressive-photo-cache'

test('refreshes recency on get and revokes the least recently used URL', () => {
  const revoked: string[] = []
  const cache = new ObjectUrlLruCache(2, (url) => revoked.push(url))

  cache.set('a', 'blob:a')
  cache.set('b', 'blob:b')
  assert.equal(cache.get('a'), 'blob:a')
  cache.set('c', 'blob:c')

  assert.equal(cache.peek('a'), 'blob:a')
  assert.equal(cache.peek('b'), null)
  assert.deepEqual(revoked, ['blob:b'])
})

test('revokes replaced entries and every remaining URL on clear', () => {
  const revoked: string[] = []
  const cache = new ObjectUrlLruCache(2, (url) => revoked.push(url))

  cache.set('a', 'blob:a1')
  cache.set('a', 'blob:a2')
  cache.set('b', 'blob:b')
  cache.clear()

  assert.deepEqual(revoked, ['blob:a1', 'blob:a2', 'blob:b'])
})
