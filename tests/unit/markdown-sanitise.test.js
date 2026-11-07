import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { sanitise, renderMarkdownSafely } from '../../js/ui/components/markdown-viewer.js';

const window = new JSDOM('').window;
const purifier = createDOMPurify(window);

function hasEventHandlerAttribute(html) {
  const doc = new JSDOM(`<body>${html}</body>`).window.document;
  return [...doc.body.querySelectorAll('*')].some(el =>
    el.getAttributeNames().some(name => name.startsWith('on')));
}

test('strips slash-separated event handlers', () => {
  const payload = '<img/src=x/onerror=alert(1)>';
  // Browsers read this as src="x/onerror=alert(1)" (inert text), so check attributes, not substrings.
  assert.equal(hasEventHandlerAttribute(sanitise(payload, purifier)), false);
  const rendered = renderMarkdownSafely(payload, { markedLib: marked, purifier });
  assert.equal(hasEventHandlerAttribute(rendered), false);
});

test('strips space-separated event handlers', () => {
  const payload = '<img src=x onerror=alert(1)>';
  assert.ok(!sanitise(payload, purifier).includes('onerror'));
  const rendered = renderMarkdownSafely(payload, { markedLib: marked, purifier });
  assert.equal(hasEventHandlerAttribute(rendered), false);
});

test('strips entity-encoded javascript URLs', () => {
  const out = renderMarkdownSafely('[x](javascrip&#116;:alert(1))', { markedLib: marked, purifier });
  assert.ok(!out.includes('alert'), out);
});

test('keeps ordinary markdown', () => {
  const out = renderMarkdownSafely('# Title\n\n**bold**', { markedLib: marked, purifier });
  assert.ok(out.includes('<h1'));
  assert.ok(out.includes('<strong'));
});

test('falls back to escaped text when DOMPurify is missing', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const out = renderMarkdownSafely(payload, { markedLib: marked, purifier: undefined });
  assert.ok(out.startsWith('<pre'));
  assert.ok(!out.includes('<img'));
});

test('falls back to escaped text when marked is missing', () => {
  const out = renderMarkdownSafely('<b>hi</b>', { markedLib: undefined, purifier });
  assert.ok(out.startsWith('<pre'));
  assert.ok(out.includes('&lt;b&gt;'));
});
