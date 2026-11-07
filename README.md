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

**You need to be online the first time.** The page itself is local, but JSZip, marked, DOMPurify,
Lucide and FileSaver load from CDNs, so with no network the markdown preview falls back to plain
text and the ZIP download does not work at all. Your export data is still never uploaded anywhere --
only the libraries come down. To run it fully offline, vendor those five scripts next to
`index.html` and point the tags at the local copies.

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

## After You Download the Package

Step A2 saves `migration-package.zip`. Unzip it -- everything is inside `migration-package/`:

```
migration-package/
  summary.md                  what the export contained
  context-document.md         paste into the new account's project or memory
  memory-import-script.txt    prompts to replay memory in the new account
  memory-capture.md           memory as captured from the old account
  conversations/
    index.json                every conversation, with dates and counts
    recent/                   last 90 days, one .md per conversation
    archive/                  everything older
  artifacts/
    index.json                names the file written for each artifact
    <artifact files>          source code and documents, as real files
  projects/
    index.json
    <project>/README.md       the project's blueprint, plus its docs
```

Nothing here imports itself -- Claude has no import endpoint, so the package is the input to Track B:

1. Read `summary.md` first and check the counts match what you expect.
2. Keep the unzipped folder somewhere permanent. `conversations/` is your readable archive of the
   old account and the only copy once that account is gone.
3. Work steps B3 to B6 in the app with the folder open beside it: B3 pastes
   `memory-import-script.txt`, B4 recreates each project from its `README.md`, B5 uploads the
   artifacts you marked important in A4, B6 validates the result.
4. Re-upload knowledge files yourself from your originals. The export does not contain them.

The ZIP is built in your browser and never uploaded anywhere, so it is yours to keep, move or
delete -- and worth a backup before you close the old account.

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
    unique-file-names.js # Per-folder name allocator; stops same-titled
                         #   conversations overwriting each other in the package
  ui/
    sidebar.js          # Step navigation
    step-renderer.js    # Dynamic step loading
    components/         # Reusable UI components
    steps/              # One module per step (step-a1.js .. step-b6.js),
                        #   plus step-a2-processing.js and step-a2-results-view.js
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
