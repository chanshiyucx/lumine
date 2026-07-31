import assert from 'node:assert/strict'
import test from 'node:test'
import { formatLoadingBytes } from './loading-indicator'

test('keeps download progress in a stable unit and precision', () => {
  assert.equal(formatLoadingBytes(0), '0.0 MB')
  assert.equal(formatLoadingBytes(80 * 1024), '0.1 MB')
  assert.equal(formatLoadingBytes(1024 * 1024), '1.0 MB')
  assert.equal(formatLoadingBytes(11.5 * 1024 * 1024), '11.5 MB')
})
