import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFileName, safeExtension } from '../../js/processing/zip-writer.js';

test('strips parent-directory segments from doc names', () => {
  const result = safeFileName('../../evil');
  assert.equal(result.includes('.'), false);
  assert.equal(result.includes('/'), false);
  assert.equal(result, 'evil');
});

test('strips slashes from doc names', () => {
  assert.equal(safeFileName('a/b/c'), 'abc');
});

test('keeps a plain extension', () => {
  assert.equal(safeExtension('.md'), '.md');
});

test('drops a path-bearing extension', () => {
  assert.equal(safeExtension('./../y'), '');
});
