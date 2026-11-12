import test from 'node:test'
import assert from 'node:assert/strict'
import { extractYoutubeId, canonicalYoutubeUrl } from '../src/youtube.js'

test('extractYoutubeId handles watch, short, shorts, and music URLs', () => {
  assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
  assert.equal(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ?t=42'), 'dQw4w9WgXcQ')
  assert.equal(extractYoutubeId('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD123'), 'dQw4w9WgXcQ')
  assert.equal(extractYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
})

test('extractYoutubeId rejects non-YouTube domains and invalid IDs', () => {
  assert.equal(extractYoutubeId('https://example.com/watch?v=dQw4w9WgXcQ'), null)
  assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=short'), null)
  assert.equal(extractYoutubeId('javascript:alert(1)'), null)
  assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=abc;rm+-rf'), null)
})

test('canonicalYoutubeUrl builds safe watch URL', () => {
  assert.equal(canonicalYoutubeUrl('dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  assert.throws(() => canonicalYoutubeUrl('bad-id'))
})
