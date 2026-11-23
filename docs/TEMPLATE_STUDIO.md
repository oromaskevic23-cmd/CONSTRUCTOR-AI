# Template Studio 0.4

The studio builds three local applications from reviewed source: Task Manager, Business CRM and Business Dashboard. Users can edit the project name and accent, interact with a temporary preview and download an editable ZIP.

## Acceptance evidence

- Domain tests cover create, update, status changes, delete, summaries, duplicate identities and invalid records.
- Every template is exported to a fresh temporary directory; its own record tests and integrity verifier are executed with Node.js.
- A deliberate source modification makes the exported integrity check fail.
- HTML escaping, deterministic output, path traversal, duplicate ZIP entries and size bounds are tested.
- The local server serves only explicitly allowed assets. The browser preview uses reviewed modules, never model output.

The manifest is unsigned. It does not establish legal ownership, a trusted release authority or production security. The exported tests cover record operations; they are not an automated browser suite.

## Data and execution

Preview records use temporary memory. Exported apps start empty and persist records in that browser's localStorage. **Export data** downloads a JSON backup. **Restore JSON backup** validates the schema, template type, record fields, unique IDs and 1 MiB size limit, then shows a review with the number and details of new, conflicting and workspace-only records.

- **Add new records** imports only IDs missing from the current workspace and keeps all existing records. It is unavailable when the merged workspace would exceed 250 records.
- **Replace workspace** applies the validated backup after a second confirmation. Cancel or a rejected recovery leaves the workspace intact.
- If the workspace changes after the backup is selected, review it again. An observed change in browser storage from another tab blocks the recovery write.

The JSON backup schema is unchanged, so existing backups remain valid. If browser storage is already unavailable, the current session can still review and recover data in memory. Exporting that session does not recover previously unreadable data. The downloaded application ZIP contains source files. Workspace data remains in the browser unless explicitly exported.

Before saving, an exported app checks whether the stored workspace changed since the tab last read or wrote it. If a conflicting change is detected, the tab stops writing, preserves its current edits in memory and advises the user to export them before reloading. This is a best-effort stale-tab check: localStorage has no atomic compare-and-set, so simultaneous writes can still race. Use one tab per workspace and keep JSON backups.

The local static server uses 127.0.0.1. Neither the studio nor its exports execute arbitrary model-generated code. Existing provider planning and quarantine modules retain their own explicit authorization boundaries.

## Reproduce

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm start
```

Open http://127.0.0.1:4173/studio. For an exported application, run `npm run verify`, `npm test` and `npm start` from the extracted directory. Node.js 22 or later is required.

## Publishing the static studio

`node tools/build-studio.mjs OUTPUT_DIRECTORY` copies only the reviewed browser files and writes a deployment hash manifest. It performs no hosting or account configuration. The public demonstration is hosted within the existing IMPERIAL Core GitHub Pages site.
