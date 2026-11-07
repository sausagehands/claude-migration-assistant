import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateArtifactNames, buildDedupedArtifactIndex } from '../../js/processing/zip-writer.js';

test('two artifacts with the same file name both survive', () => {
  const names = allocateArtifactNames([
    { fileName: 'chart-abc123.html', content: 'one' },
    { fileName: 'chart-abc123.html', content: 'two' }
  ]);
  assert.equal(names.length, 2);
  assert.notEqual(names[0], names[1]);
  assert.equal(names[0], 'chart-abc123.html');
  assert.equal(names[1], 'chart-abc123-2.html');
});

test('an artifact cannot take index.json', () => {
  const names = allocateArtifactNames([{ fileName: 'index.json', content: 'x' }]);
  assert.equal(names[0], 'index-2.json');
});

test('the artifact index uses the deduped file name', () => {
  const index = buildDedupedArtifactIndex([
    { id: 'a1', title: 'One', type: 'text/html', fileName: 'chart-abc123.html', content: 'one' },
    { id: 'a2', title: 'Two', type: 'text/html', fileName: 'chart-abc123.html', content: 'two' }
  ]);
  assert.equal(index.length, 2);
  assert.equal(index[0].fileName, 'chart-abc123.html');
  assert.equal(index[1].fileName, 'chart-abc123-2.html');
  assert.equal(index[1].contentLength, 3);
});
