import { loadFromStorage, exportSessionJSON, importSessionJSON, resetState } from './state.js';
import { renderSidebar, renderProgressBar } from './ui/sidebar.js';
import { initStepRenderer } from './ui/step-renderer.js';
import { downloadBlob } from './processing/zip-writer.js';

export function init() {
  // Restore saved state
  loadFromStorage();

  // Render sidebar
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) renderSidebar(sidebar);

  // Render progress bar
  const progress = document.getElementById('app-progress');
  if (progress) renderProgressBar(progress);

  // Init step renderer
  const main = document.getElementById('step-container');
  if (main) initStepRenderer(main);

  // Wire up header actions
  setupHeaderActions();

  // Activate Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setupHeaderActions() {
  const exportBtn = document.getElementById('btn-export-session');
  const importBtn = document.getElementById('btn-import-session');
  const resetBtn = document.getElementById('btn-reset');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const json = exportSessionJSON();
      const blob = new Blob([json], { type: 'application/json' });
      downloadBlob(blob, `migration-session-${new Date().toISOString().slice(0, 10)}.json`);
    });
  }

  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const ok = importSessionJSON(reader.result);
          if (ok) {
            window.location.reload();
          } else {
            alert('Failed to import session. The file may be corrupted.');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all progress? This cannot be undone.')) {
        resetState();
        window.location.reload();
      }
    });
  }
}

// Boot
document.addEventListener('DOMContentLoaded', init);
