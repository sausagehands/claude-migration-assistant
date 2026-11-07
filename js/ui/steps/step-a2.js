// js/ui/steps/step-a2.js
// Step A2: upload a Claude export (ZIPs, JSON files or a whole folder), pick whose data
// to process, and show the resulting migration package preview.
// Depends on: processing/export-file-collector.js, processing/export-reader.js,
//   processing/admin-reader.js, step-a2-processing.js, step-a2-results-view.js
// Called by: ui/step-renderer.js

import { setExportData, getState } from '../../state.js';
import { escapeHtml } from '../../utils.js';
import { createDropzone } from '../components/dropzone.js';
import { createProgressIndicator } from '../components/progress-indicator.js';
import { icon } from '../components/icon.js';
import { buildMigrationPackage, downloadBlob } from '../../processing/zip-writer.js';
import { collectExportEntries } from '../../processing/export-file-collector.js';
import { readClaudeExport } from '../../processing/export-reader.js';
import { buildUserList, filterByUser, selectEntireExport } from '../../processing/admin-reader.js';
import { processAndStoreUserSelection } from './step-a2-processing.js';
import { buildResultsHtml, buildDownloadButtonLabelHtml } from './step-a2-results-view.js';

const EXPORT_DROPZONE_OPTIONS = {
  accept: '.zip,.json',
  multiple: true,
  allowFolders: true,
  hint: 'Drop the whole unzipped export folder, or click to select all the export .zip files'
};

const BOX_ICON_SIZE = 16;
const BUTTON_ICON_SIZE = 12;

// Module-scoped: holds raw admin data so it doesn't bloat reactive state / localStorage
let adminRawData = null;

export function render(container, _stepState, globalState) {
  if (globalState.exportData.exportMode === 'admin') {
    renderAdminMode(container, globalState);
  } else {
    renderPersonalMode(container, globalState);
  }
}

// ─── Personal mode ────────────────────────────────────────────────────────────

function renderPersonalMode(container, globalState) {
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

  const progressArea = container.querySelector('#a2-progress-area');
  const resultsArea = container.querySelector('#a2-results');

  createDropzone(container.querySelector('#a2-dropzone'), {
    ...EXPORT_DROPZONE_OPTIONS,
    label: 'Drop your Claude export here',
    onFiles: (files) => processPersonalUpload(files, progressArea, resultsArea)
  });

  if (globalState.exportData.conversations) {
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
      <span class="info-box__icon">${icon('alert-triangle', BOX_ICON_SIZE)}</span>
      <span>${escapeHtml(w)}</span>
    </div>`
  ).join('');
  progressArea.insertAdjacentHTML('beforeend', warningHtml);
  refreshIcons();
}

function showError(progressIndicator, targetArea, err) {
  console.error('Export processing failed:', err);
  progressIndicator.update('Error: ' + err.message, 0);
  targetArea.innerHTML = `
    <div class="info-box info-box--warning" style="margin-top: var(--space-md);">
      <span class="info-box__icon">${icon('alert-triangle', BOX_ICON_SIZE)}</span>
      <span>${escapeHtml(err.message)}</span>
    </div>
  `;
  refreshIcons();
}

// ─── Admin mode ───────────────────────────────────────────────────────────────

function renderAdminMode(container, globalState) {
  container.innerHTML = `
    <div id="a2-admin-upload"></div>
    <div id="a2-progress-area"></div>
    <div id="a2-user-picker"></div>
    <div id="a2-results"></div>
  `;

  const areas = {
    upload: container.querySelector('#a2-admin-upload'),
    progress: container.querySelector('#a2-progress-area'),
    userPicker: container.querySelector('#a2-user-picker'),
    results: container.querySelector('#a2-results')
  };

  if (globalState.exportData.conversations) {
    showResults(areas.results, globalState);
    showAdminNotice(areas.upload, 'Processing complete for selected user. You can re-upload admin files to start over.');
    return;
  }

  // WHY: the user list lives in state but the raw export does not, so after a reload
  // there is nothing left to filter and the upload has to start again.
  if (globalState.exportData.adminUsers && adminRawData) {
    showAdminNotice(areas.upload, 'Admin export loaded. Select a team member below to process their data.');
    renderUserPicker(areas.userPicker, areas.progress, areas.results, globalState);
    return;
  }

  renderAdminDropzone(areas);
}

function showAdminNotice(uploadArea, message) {
  uploadArea.innerHTML = `
    <div class="info-box info-box--success" style="margin-bottom: var(--space-lg);">
      <span class="info-box__icon">${icon('check-circle', BOX_ICON_SIZE)}</span>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  refreshIcons();
}

function renderAdminDropzone(areas) {
  areas.upload.innerHTML = `
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

  createDropzone(areas.upload.querySelector('#a2-admin-dz'), {
    ...EXPORT_DROPZONE_OPTIONS,
    label: 'Drop the admin export here',
    onFiles: (files) => processAdminUpload(files, areas.progress, areas.userPicker, areas.results)
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
          ${users.map(u => buildUserRowHtml(u)).join('')}
        </tbody>
      </table>
    </div>
  `;

  pickerArea.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="select-user"]');
    if (!btn) return;
    processSelectedUser(btn.dataset.uuid, pickerArea, progressArea, resultsArea);
  });

  refreshIcons();
}

function buildUserRowHtml(user) {
  const departedClass = user.full_name === '[Departed User]' ? 'user-picker-row--departed' : '';
  return `
    <tr class="user-picker-row ${departedClass}" data-uuid="${escapeHtml(user.uuid)}">
      <td>${escapeHtml(user.full_name)}</td>
      <td>${escapeHtml(user.email_address || '--')}</td>
      <td>${user.conversationCount}</td>
      <td>
        <button class="btn btn--small" data-action="select-user" data-uuid="${escapeHtml(user.uuid)}">
          ${icon('arrow-right', BUTTON_ICON_SIZE)} Select
        </button>
      </td>
    </tr>
  `;
}

async function processSelectedUser(userUuid, pickerArea, progressArea, resultsArea) {
  if (!adminRawData) return;

  // Disable picker while processing
  setPickerEnabled(pickerArea, false);

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
    setPickerEnabled(pickerArea, true);
  }
}

function setPickerEnabled(pickerArea, isEnabled) {
  pickerArea.querySelectorAll('button').forEach(b => { b.disabled = !isEnabled; });
}

// ─── Shared results display ───────────────────────────────────────────────────

function showResults(resultsArea, state) {
  if (!state.exportData.conversations) return;

  resultsArea.innerHTML = buildResultsHtml(state);
  wireDownloadButton(resultsArea.querySelector('#a2-download'), state);
  refreshIcons();
}

function wireDownloadButton(downloadButton, state) {
  downloadButton.addEventListener('click', async () => {
    downloadButton.disabled = true;
    downloadButton.textContent = 'Building ZIP...';
    try {
      const blob = await buildMigrationPackage(state);
      downloadBlob(blob, 'migration-package.zip');
    } catch (e) {
      alert('Failed to build ZIP: ' + e.message);
    }
    downloadButton.disabled = false;
    downloadButton.innerHTML = buildDownloadButtonLabelHtml();
    refreshIcons();
  });
}

// WHY: lucide replaces <i> placeholders with SVG, so any markup carrying an icon has to
// ask for a re-scan; it is absent until the CDN script loads.
function refreshIcons() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function cleanup() {
  // Don't clear adminRawData on step cleanup -- user may navigate back
}
