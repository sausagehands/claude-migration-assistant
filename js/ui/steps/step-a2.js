// js/ui/steps/step-a2.js
// Step A2: upload a Claude export (ZIPs, JSON files or a whole folder), pick whose data
// to process, and show the resulting migration package preview.
// Depends on: processing/export-file-collector.js, processing/export-reader.js,
//   processing/admin-reader.js, step-a2-processing.js
// Called by: ui/step-renderer.js

import { setExportData, getState } from '../../state.js';
import { escapeHtml } from '../../utils.js';
import { createDropzone } from '../components/dropzone.js';
import { createProgressIndicator } from '../components/progress-indicator.js';
import { icon } from '../components/icon.js';
import { categorizeByAge } from '../../processing/conversation-parser.js';
import { buildMigrationPackage, downloadBlob } from '../../processing/zip-writer.js';
import { collectExportEntries } from '../../processing/export-file-collector.js';
import { readClaudeExport } from '../../processing/export-reader.js';
import { buildUserList, filterByUser, selectEntireExport } from '../../processing/admin-reader.js';
import { processAndStoreUserSelection } from './step-a2-processing.js';

const EXPORT_DROPZONE_OPTIONS = {
  accept: '.zip,.json',
  multiple: true,
  allowFolders: true,
  hint: 'Drop the whole unzipped export folder, or click to select all the export .zip files'
};

// Module-scoped: holds raw admin data so it doesn't bloat reactive state / localStorage
let adminRawData = null;

export function render(container, stepState, globalState) {
  const mode = globalState.exportData.exportMode;

  if (mode === 'admin') {
    renderAdminMode(container, stepState, globalState);
  } else {
    renderPersonalMode(container, stepState, globalState);
  }
}

// ─── Personal mode ────────────────────────────────────────────────────────────

function renderPersonalMode(container, stepState, globalState) {
  const hasData = !!globalState.exportData.conversations;

  container.innerHTML = `
    <div class="step-section">
      <div class="step-section__title">Upload Your Export</div>
      <div class="step-section__description">
        Claude now sends the export as several ZIP files (conversations, memories, projects, ...).
        Drop the whole folder, or select all of the ZIP files at once. Everything is processed
        locally in your browser -- no data leaves your machine.
      </div>
      <div id="a2-dropzone"></div>
    </div>
    <div id="a2-progress-area"></div>
    <div id="a2-results"></div>
  `;

  const dzContainer = container.querySelector('#a2-dropzone');
  const progressArea = container.querySelector('#a2-progress-area');
  const resultsArea = container.querySelector('#a2-results');

  createDropzone(dzContainer, {
    ...EXPORT_DROPZONE_OPTIONS,
    label: 'Drop your Claude export here',
    onFiles: (files) => processPersonalUpload(files, progressArea, resultsArea)
  });

  if (hasData) {
    showResults(resultsArea, globalState);
  }
}

async function processPersonalUpload(files, progressArea, resultsArea) {
  const progressIndicator = createProgressIndicator(progressArea);
  resultsArea.innerHTML = '';

  try {
    const exportData = await readUploadedExport(files, progressIndicator);
    await processAndStoreUserSelection(selectEntireExport(exportData), progressIndicator);
    progressIndicator.complete('Processing complete');
    showWarnings(progressArea, exportData.warnings);
    showResults(resultsArea, getState());
  } catch (err) {
    showError(progressIndicator, resultsArea, err);
  }
}

async function readUploadedExport(files, progressIndicator) {
  const entries = await collectExportEntries(files, (phase, pct) => progressIndicator.update(phase, pct));
  return readClaudeExport(entries, (phase, pct) => progressIndicator.update(phase, 20 + Math.round(pct * 0.2)));
}

function showWarnings(progressArea, warnings) {
  const warningHtml = warnings.map(w =>
    `<div class="info-box info-box--warning" style="margin-top: var(--space-sm);">
      <span class="info-box__icon">${icon('alert-triangle', 16)}</span>
      <span>${escapeHtml(w)}</span>
    </div>`
  ).join('');
  progressArea.insertAdjacentHTML('beforeend', warningHtml);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showError(progressIndicator, targetArea, err) {
  console.error('Export processing failed:', err);
  progressIndicator.update('Error: ' + err.message, 0);
  targetArea.innerHTML = `
    <div class="info-box info-box--warning" style="margin-top: var(--space-md);">
      <span class="info-box__icon">${icon('alert-triangle', 16)}</span>
      <span>${escapeHtml(err.message)}</span>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── Admin mode ───────────────────────────────────────────────────────────────

function renderAdminMode(container, stepState, globalState) {
  const hasData = !!globalState.exportData.conversations;
  const hasUsers = !!globalState.exportData.adminUsers;

  container.innerHTML = `
    <div id="a2-admin-upload"></div>
    <div id="a2-progress-area"></div>
    <div id="a2-user-picker"></div>
    <div id="a2-results"></div>
  `;

  const uploadArea = container.querySelector('#a2-admin-upload');
  const progressArea = container.querySelector('#a2-progress-area');
  const userPickerArea = container.querySelector('#a2-user-picker');
  const resultsArea = container.querySelector('#a2-results');

  if (hasData) {
    // Already processed a user -- show results
    showResults(resultsArea, globalState);
    // Also show a "change user" option
    uploadArea.innerHTML = `
      <div class="info-box info-box--success" style="margin-bottom: var(--space-lg);">
        <span class="info-box__icon">${icon('check-circle', 16)}</span>
        <span>Processing complete for selected user. You can re-upload admin files to start over.</span>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  if (hasUsers && adminRawData) {
    // Have parsed data and user list -- show user picker
    uploadArea.innerHTML = `
      <div class="info-box info-box--success" style="margin-bottom: var(--space-lg);">
        <span class="info-box__icon">${icon('check-circle', 16)}</span>
        <span>Admin export loaded. Select a team member below to process their data.</span>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    renderUserPicker(userPickerArea, progressArea, resultsArea, globalState);
    return;
  }

  // Show upload dropzone
  uploadArea.innerHTML = `
    <div class="step-section">
      <div class="step-section__title">Upload Admin Export</div>
      <div class="step-section__description">
        Drop the whole admin export folder, or select all of its ZIP / JSON files at once.
        At minimum, <strong>conversations.json</strong> is required.
        Everything is processed locally in your browser.
      </div>
      <div id="a2-admin-dz"></div>
    </div>
  `;

  createDropzone(uploadArea.querySelector('#a2-admin-dz'), {
    ...EXPORT_DROPZONE_OPTIONS,
    label: 'Drop the admin export here',
    onFiles: (files) => processAdminUpload(files, progressArea, userPickerArea, resultsArea)
  });
}

async function processAdminUpload(files, progressArea, userPickerArea, resultsArea) {
  const progressIndicator = createProgressIndicator(progressArea);

  try {
    const data = await readUploadedExport(files, progressIndicator);

    // Store raw data in module scope (not in state)
    adminRawData = data;

    const userList = buildUserList(data.users, data.conversations);
    if (userList.length === 0) {
      throw new Error('No conversations with an account ID were found. Is this a Claude export?');
    }
    setExportData('adminUsers', userList);

    progressIndicator.complete(`Loaded ${data.conversations.length} conversations across ${userList.length} users`);
    showWarnings(progressArea, data.warnings);
    renderUserPicker(userPickerArea, progressArea, resultsArea, getState());
  } catch (err) {
    showError(progressIndicator, resultsArea, err);
  }
}

function renderUserPicker(pickerArea, progressArea, resultsArea, state) {
  const users = state.exportData.adminUsers || [];

  pickerArea.innerHTML = `
    <div class="step-section">
      <div class="step-section__title">Select Team Member</div>
      <div class="step-section__description">
        Choose which user's data to process for migration.
      </div>
      <table class="user-picker-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Conversations</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr class="user-picker-row ${u.full_name === '[Departed User]' ? 'user-picker-row--departed' : ''}" data-uuid="${escapeHtml(u.uuid)}">
              <td>${escapeHtml(u.full_name)}</td>
              <td>${escapeHtml(u.email_address || '--')}</td>
              <td>${u.conversationCount}</td>
              <td>
                <button class="btn btn--small" data-action="select-user" data-uuid="${escapeHtml(u.uuid)}">
                  ${icon('arrow-right', 12)} Select
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  pickerArea.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="select-user"]');
    if (!btn) return;
    const uuid = btn.dataset.uuid;
    processSelectedUser(uuid, pickerArea, progressArea, resultsArea);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function processSelectedUser(userUuid, pickerArea, progressArea, resultsArea) {
  if (!adminRawData) return;

  // Disable picker while processing
  pickerArea.querySelectorAll('button').forEach(b => b.disabled = true);

  const progressIndicator = createProgressIndicator(progressArea);

  try {
    progressIndicator.update('Filtering user data...', 20);
    setExportData('selectedUserUuid', userUuid);
    await processAndStoreUserSelection(filterByUser(adminRawData, userUuid), progressIndicator);
    progressIndicator.complete('Processing complete');
    pickerArea.innerHTML = '';
    showResults(resultsArea, getState());
  } catch (err) {
    showError(progressIndicator, resultsArea, err);
    pickerArea.querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

// ─── Shared results display ───────────────────────────────────────────────────

function showResults(resultsArea, state) {
  const { conversations, artifacts, contextDocument, memoryScript, userProjects } = state.exportData;
  if (!conversations) return;

  const { recent, archive } = categorizeByAge(conversations);
  const stats = state.steps.a2.stats || {};

  // Show selected user info if admin mode
  const isAdmin = state.exportData.exportMode === 'admin';
  const selectedUser = isAdmin && state.exportData.adminUsers
    ? state.exportData.adminUsers.find(u => u.uuid === state.exportData.selectedUserUuid)
    : null;

  const userBanner = selectedUser ? `
    <div class="info-box info-box--info" style="margin-bottom: var(--space-md);">
      <span class="info-box__icon">${icon('user', 16)}</span>
      <span>Showing data for <strong>${escapeHtml(selectedUser.full_name)}</strong>${selectedUser.email_address ? ` (${escapeHtml(selectedUser.email_address)})` : ''}</span>
    </div>
  ` : '';

  resultsArea.innerHTML = `
    ${userBanner}
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card__value">${conversations.length}</div>
        <div class="stat-card__label">Conversations</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${stats.messageCount || 0}</div>
        <div class="stat-card__label">Messages</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${(artifacts || []).length}</div>
        <div class="stat-card__label">Artifacts</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${(userProjects || []).length}</div>
        <div class="stat-card__label">Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${recent.length}</div>
        <div class="stat-card__label">Recent (90d)</div>
      </div>
    </div>

    <div class="step-section" style="margin-top: var(--space-lg);">
      <div class="step-section__title">Output Preview</div>
      <div class="output-tree">
        <div class="output-tree__item output-tree__item--folder">
          ${icon('folder', 14)} migration-package/
        </div>
        <div class="output-tree__item output-tree__item--file" style="--depth:1">
          ${icon('file-text', 14)} summary.md
        </div>
        <div class="output-tree__item output-tree__item--folder" style="--depth:1">
          ${icon('folder', 14)} conversations/
          <span class="output-tree__count">${conversations.length} files</span>
        </div>
        <div class="output-tree__item output-tree__item--file" style="--depth:2">
          ${icon('file-text', 14)} index.json
        </div>
        <div class="output-tree__item output-tree__item--folder" style="--depth:2">
          ${icon('folder', 14)} recent/
          <span class="output-tree__count">${recent.length} files</span>
        </div>
        <div class="output-tree__item output-tree__item--folder" style="--depth:2">
          ${icon('folder', 14)} archive/
          <span class="output-tree__count">${archive.length} files</span>
        </div>
        <div class="output-tree__item output-tree__item--folder" style="--depth:1">
          ${icon('folder', 14)} artifacts/
          <span class="output-tree__count">${(artifacts || []).length} files</span>
        </div>
        ${(userProjects || []).length > 0 ? `
        <div class="output-tree__item output-tree__item--folder" style="--depth:1">
          ${icon('folder', 14)} projects/
          <span class="output-tree__count">${userProjects.length} projects</span>
        </div>
        ` : ''}
        <div class="output-tree__item output-tree__item--file" style="--depth:1">
          ${icon('file-text', 14)} context-document.md
        </div>
        <div class="output-tree__item output-tree__item--file" style="--depth:1">
          ${icon('file-text', 14)} memory-import-script.txt
        </div>
        ${state.exportData.userMemory ? `
        <div class="output-tree__item output-tree__item--file" style="--depth:1">
          ${icon('file-text', 14)} memory-capture.md
        </div>
        ` : ''}
      </div>
    </div>

    <div class="step-actions">
      <button class="btn btn--primary" id="a2-download">
        ${icon('download', 14)}
        Download Migration Package
      </button>
    </div>
  `;

  const dlBtn = resultsArea.querySelector('#a2-download');
  dlBtn.addEventListener('click', async () => {
    dlBtn.disabled = true;
    dlBtn.textContent = 'Building ZIP...';
    try {
      const blob = await buildMigrationPackage(state);
      downloadBlob(blob, 'migration-package.zip');
    } catch (e) {
      alert('Failed to build ZIP: ' + e.message);
    }
    dlBtn.disabled = false;
    dlBtn.innerHTML = `${icon('download', 14)} Download Migration Package`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function cleanup() {
  // Don't clear adminRawData on step cleanup -- user may navigate back
}
