import { escapeHtml } from '../../utils.js';

export function createMarkdownViewer(container, options = {}) {
  const {
    markdown = '',
    editable = false,
    onChange = null
  } = options;

  let currentMode = 'preview';
  let currentMarkdown = markdown;

  function renderTabs() {
    if (!editable) return '';
    return `
      <div class="md-tabs">
        <button class="md-tabs__tab ${currentMode === 'preview' ? 'md-tabs__tab--active' : ''}" data-mode="preview">Preview</button>
        <button class="md-tabs__tab ${currentMode === 'edit' ? 'md-tabs__tab--active' : ''}" data-mode="edit">Edit</button>
      </div>
    `;
  }

  function render() {
    container.innerHTML = `
      ${renderTabs()}
      <div id="md-content"></div>
    `;

    const contentEl = container.querySelector('#md-content');

    if (currentMode === 'preview') {
      contentEl.innerHTML = `<div class="md-preview">${renderMarkdown(currentMarkdown)}</div>`;
    } else {
      contentEl.innerHTML = `<textarea class="md-editor">${escapeHtml(currentMarkdown)}</textarea>`;
      const textarea = contentEl.querySelector('.md-editor');
      textarea.addEventListener('input', () => {
        currentMarkdown = textarea.value;
        if (onChange) onChange(currentMarkdown);
      });
    }

    // Wire tab clicks
    if (editable) {
      container.querySelectorAll('.md-tabs__tab').forEach(tab => {
        tab.addEventListener('click', () => {
          currentMode = tab.dataset.mode;
          render();
        });
      });
    }
  }

  render();

  return {
    getContent() { return currentMarkdown; },
    setContent(md) {
      currentMarkdown = md;
      render();
    }
  };
}

function renderMarkdown(md) {
  return renderMarkdownSafely(md, {
    markedLib: typeof marked !== 'undefined' ? marked : undefined,
    purifier: typeof DOMPurify !== 'undefined' ? DOMPurify : undefined
  });
}

// WHY injected libs: node tests pass their own marked/DOMPurify; the browser passes the CDN globals.
export function sanitise(html, purifier) {
  return purifier.sanitize(html);
}

// Never returns unsanitised HTML: if either CDN script is missing, show escaped text.
export function renderMarkdownSafely(md, { markedLib, purifier }) {
  if (markedLib && markedLib.parse && purifier && purifier.sanitize) {
    try {
      return sanitise(markedLib.parse(md), purifier);
    } catch (e) {
      console.warn('Markdown parse error:', e);
    }
  }
  return `<pre style="white-space: pre-wrap;">${escapeHtml(md)}</pre>`;
}
