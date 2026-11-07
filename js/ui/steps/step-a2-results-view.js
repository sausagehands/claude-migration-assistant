// js/ui/steps/step-a2-results-view.js
// Builds the markup for step A2's results panel: selected-user banner, stat grid and
// the output-tree preview of the migration package.
// Depends on: utils.js, ui/components/icon.js, processing/conversation-parser.js
// Called by: ui/steps/step-a2.js
// WHY: split out of step-a2.js so that file stays orchestration only; the markup had
// grown past the function-size limit and the tree rows repeated the same four lines.

import { escapeHtml } from '../../utils.js';
import { icon } from '../components/icon.js';
import { categorizeByAge } from '../../processing/conversation-parser.js';

const ROW_ICON_SIZE = 14;
const BOX_ICON_SIZE = 16;
const BUTTON_ICON_SIZE = 14;
const DOWNLOAD_LABEL = 'Download Migration Package';

/**
 * @param {object} state - full app state; must already hold exportData.conversations
 * @returns {string} HTML for the whole results panel
 */
export function buildResultsHtml(state) {
  const counts = summarizePackage(state);
  return `
    ${buildUserBannerHtml(findSelectedUser(state))}
    ${buildStatGridHtml(counts)}
    ${buildOutputTreeHtml(counts)}
    ${buildDownloadActionHtml()}
  `;
}

/** Label for the download button, reused when it is restored after a build. */
export function buildDownloadButtonLabelHtml() {
  return `${icon('download', BUTTON_ICON_SIZE)} ${DOWNLOAD_LABEL}`;
}

function summarizePackage(state) {
  const { conversations, artifacts, userProjects, userMemory } = state.exportData;
  const { recent, archive } = categorizeByAge(conversations);
  const stats = (state.steps && state.steps.a2 && state.steps.a2.stats) || {};

  return {
    conversations: conversations.length,
    messages: stats.messageCount || 0,
    artifacts: (artifacts || []).length,
    projects: (userProjects || []).length,
    recent: recent.length,
    archive: archive.length,
    hasUserMemory: !!userMemory
  };
}

// WHY: only admin mode processes one user out of many, so personal mode has no banner.
function findSelectedUser(state) {
  const { exportMode, adminUsers, selectedUserUuid } = state.exportData;
  if (exportMode !== 'admin' || !adminUsers) return null;
  return adminUsers.find(user => user.uuid === selectedUserUuid) || null;
}

function buildUserBannerHtml(selectedUser) {
  if (!selectedUser) return '';
  const email = selectedUser.email_address
    ? ` (${escapeHtml(selectedUser.email_address)})`
    : '';
  return `
    <div class="info-box info-box--info" style="margin-bottom: var(--space-md);">
      <span class="info-box__icon">${icon('user', BOX_ICON_SIZE)}</span>
      <span>Showing data for <strong>${escapeHtml(selectedUser.full_name)}</strong>${email}</span>
    </div>
  `;
}

function buildStatGridHtml(counts) {
  const cards = [
    { value: counts.conversations, label: 'Conversations' },
    { value: counts.messages, label: 'Messages' },
    { value: counts.artifacts, label: 'Artifacts' },
    { value: counts.projects, label: 'Projects' },
    { value: counts.recent, label: 'Recent (90d)' }
  ];
  return `
    <div class="stat-grid">
      ${cards.map(card => `
      <div class="stat-card">
        <div class="stat-card__value">${card.value}</div>
        <div class="stat-card__label">${card.label}</div>
      </div>
      `).join('')}
    </div>
  `;
}

function buildOutputTreeHtml(counts) {
  const rows = [
    treeFolder('migration-package/', 0),
    treeFile('summary.md', 1),
    treeFolder('conversations/', 1, `${counts.conversations} files`),
    treeFile('index.json', 2),
    treeFolder('recent/', 2, `${counts.recent} files`),
    treeFolder('archive/', 2, `${counts.archive} files`),
    treeFolder('artifacts/', 1, `${counts.artifacts} files`),
    counts.projects > 0 ? treeFolder('projects/', 1, `${counts.projects} projects`) : '',
    treeFile('context-document.md', 1),
    treeFile('memory-import-script.txt', 1),
    counts.hasUserMemory ? treeFile('memory-capture.md', 1) : ''
  ];
  return `
    <div class="step-section" style="margin-top: var(--space-lg);">
      <div class="step-section__title">Output Preview</div>
      <div class="output-tree">
        ${rows.filter(Boolean).join('\n        ')}
      </div>
    </div>
  `;
}

function treeFolder(name, depth, countText) {
  const count = countText
    ? `<span class="output-tree__count">${countText}</span>`
    : '';
  return `<div class="output-tree__item output-tree__item--folder"${depthAttr(depth)}>${icon('folder', ROW_ICON_SIZE)} ${name}${count}</div>`;
}

function treeFile(name, depth) {
  return `<div class="output-tree__item output-tree__item--file"${depthAttr(depth)}>${icon('file-text', ROW_ICON_SIZE)} ${name}</div>`;
}

function depthAttr(depth) {
  return depth > 0 ? ` style="--depth:${depth}"` : '';
}

function buildDownloadActionHtml() {
  return `
    <div class="step-actions">
      <button class="btn btn--primary" id="a2-download">
        ${buildDownloadButtonLabelHtml()}
      </button>
    </div>
  `;
}
