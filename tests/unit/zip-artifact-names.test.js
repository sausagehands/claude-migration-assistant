import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateArtifactNames } from '../../js/processing/zip-writer.js';

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
