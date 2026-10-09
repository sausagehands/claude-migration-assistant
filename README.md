# Claude Migration Assistant

A browser-based tool for migrating your Claude data from one account to another (e.g., Team to Enterprise, or personal to work). Processes everything client-side -- no data leaves your machine.

## What It Does

When you switch Claude accounts, you lose your conversation history, memory, projects, and artifacts. This tool helps you:

1. **Process your data export** -- Parses the native Claude export (ZIP or admin JSON), extracts conversations, artifacts, and generates migration documents
2. **Capture memory** -- Guides you through exporting Claude's memory of you from the old account
3. **Recreate projects** -- Helps transfer project custom instructions and knowledge documents
4. **Validate the migration** -- Provides prompts to verify everything transferred correctly

## Two Export Modes

### Personal Export
For individual users. Go to Claude Settings > Privacy > Export Data and download **all** the ZIP files. Since 2026 the export is split into several shards (`conversations-000.zip`, `memories-000.zip`, `projects-000.zip`, `frames-000.zip`, `light_metadata-000.zip`). Either select all the ZIPs at once, or unzip them and drop the whole folder. Older single-ZIP exports still work.

Memory (including per-project memories and memory files), projects and published artifacts are read straight from the export, so steps B1 and B2 fill themselves in.

### Admin Team Export
For team admins closing an account. The admin export covers all team members. Both the legacy layout (`conversations.json`, `users.json`, `memories.json`, `projects.json`) and the sharded layout (`memories/<account>.json`, `projects/<uuid>.json`, ZIP shards) are supported. The tool lets you:
- Drop the whole export folder, or select all its ZIP/JSON files at once
- Pick a specific team member from a user list
- Auto-populate their memory and projects from the admin data (skipping the manual prompt steps)

## Getting Started

No build step, no dependencies to install. Just serve the files:

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .

# Or any static file server
```

Then open http://localhost:8000 in your browser.

## How It Works

The app walks you through 10 steps in two tracks:

**Track A (Automated)** -- processes the export file client-side:
- A1: Choose export type and run the data export
- A2: Upload and process the export (ZIP or admin JSON files)
- A3: Review the auto-generated context document
- A4: Review and mark important artifacts

**Track B (Manual)** -- guides you through prompt-based migration:
- B1: Capture Claude's memory from the old account
- B2: Capture project blueprints from the old account
- B3: Restore memory in the new account
- B4: Recreate projects in the new account
- B5: Upload critical artifacts
- B6: Validate the migration

When the export includes memory and projects, steps B1 and B2 are auto-populated from it.

## What Transfers

| Data | Fidelity | Method |
|---|---|---|
| Conversation text | Exact copy (read-only archive) | Parsed from export JSON |
| Artifact source code | Exact copy (as files) | Extracted from message content |
| Memory (synthesized) | Approximate | Prompt-based capture, or auto from admin export |
| Project structure | Approximate | Manual recreation with guided prompts |
| Knowledge files | Exact if you have originals | Re-upload to new projects |

## Architecture

Static single-page app with no server component:

```
index.html              # Shell with CDN deps (JSZip, Lucide, Marked)
css/
  variables.css         # Design tokens
  layout.css            # App shell layout
  components.css        # UI component styles
js/
  app.js                # Entry point, session management
  state.js              # Reactive state with localStorage persistence
  utils.js              # Shared utilities
  data/
    step-definitions.js # Step metadata
    prompts.js          # Copy-paste prompts for manual steps
  processing/
    export-file-collector.js     # Unpacks dropped ZIPs / folders into lazy file entries (JSZip)
    export-reader.js             # Classifies entries; reads legacy + sharded export layouts
    admin-reader.js              # User list, per-user filtering, personal "take everything"
    memory-document-builder.js   # Exported memory record -> one markdown document
    conversation-parser.js
    artifact-extractor.js        # In-chat artifacts (artifacts tool, <antArtifact>)
    created-file-extractor.js    # Files Claude wrote with create_file / str_replace
    published-artifact-converter.js  # Published artifacts (artifacts/<id>/versions)
    artifact-file-naming.js
    context-generator.js
    memory-generator.js
    markdown-formatter.js
    zip-writer.js       # Builds migration package ZIP
  ui/
    sidebar.js          # Step navigation
    step-renderer.js    # Dynamic step loading
    components/         # Reusable UI components
    steps/              # One module per step (step-a1.js .. step-b6.js)
```

## Tests

```bash
npm run test:unit                                   # Node unit tests, no install needed
node scripts/check-real-export.js /path/to/export   # Counts from a real unzipped export
```

## Privacy

All processing happens in your browser. The app:
- Does not make any network requests (beyond loading CDN libraries)
- Does not send your data anywhere
- Stores only step completion state in localStorage (not conversation data)
- Ignores `login_history.json` (IP addresses) entirely
- Can export/import session progress as a local JSON file

## License

MIT
