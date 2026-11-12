import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alvoYoutube, wazeMapaUrl, wazeNavegarUrl } from '../src/media.js';

test('links do YouTube e YouTube Music', () => {
  assert.deepEqual(alvoYoutube('https://music.youtube.com/playlist?list=PLabc_123-XYZ'), { list: 'PLabc_123-XYZ' });
  assert.deepEqual(alvoYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ'), { list: 'RDdQw4w9WgXcQ' });
  assert.deepEqual(alvoYoutube('https://music.youtube.com/watch?v=dQw4w9WgXcQ'), { video: 'dQw4w9WgXcQ' });
  assert.deepEqual(alvoYoutube('https://youtu.be/dQw4w9WgXcQ?si=x'), { video: 'dQw4w9WgXcQ' });
  assert.deepEqual(alvoYoutube('dQw4w9WgXcQ'), { video: 'dQw4w9WgXcQ' });
  assert.equal(alvoYoutube('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(alvoYoutube('https://youtube.com/watch?v=<script>'), null);
  assert.equal(alvoYoutube('nada'), null);
});

test('URLs do Waze', () => {
  assert.equal(wazeMapaUrl(-23.550520, -46.633308), 'https://embed.waze.com/iframe?zoom=15&lat=-23.55052&lon=-46.63331&ct=livemap');
  assert.equal(wazeNavegarUrl(' Av. Paulista, 1000 '), 'https://waze.com/ul?q=Av.%20Paulista%2C%201000&navigate=yes');
});
