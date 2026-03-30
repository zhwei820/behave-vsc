# behave-vsc

A VS Code extension that enables debugging, running, and navigating Python [Behave](https://behave.readthedocs.io/) BDD tests directly from the editor.

## Tech Stack
- TypeScript 4.x
- VS Code Extension API (`vscode` ^1.82.0)
- Webpack (bundled to `dist/extension.js`)
- Mocha + `@vscode/test-electron` for integration tests
- `xml2js` for junit XML parsing

## Key Conventions
- `diagLog()` is used for debug/diagnostic logging (only active when `xRay` setting or integration test mode is on)
- `logger` (singleton `Logger` class) writes to VS Code output channels — use `logger.showError` / `logger.logInfo` etc. for user-visible output
- Workspace-scoped operations take a `wkspUri: vscode.Uri` parameter; settings are accessed via `getWorkspaceSettingsForFile(uri)`
- `config` (from `configuration.ts`) is a global singleton holding parsed extension config + workspace settings
- Errors are caught and surfaced via `logger.showError(e, wkspUri, run)` — don't swallow or re-throw raw

## Project Structure
- `src/extension.ts` — activation entry point; registers all commands, watchers, and providers
- `src/handlers/` — VS Code language/UI providers (autocomplete, goto, find-refs, semantic highlight, format)
- `src/parsers/` — feature file and step file parsing; maps steps to definitions
- `src/runners/` — behave process execution (run/debug); junit result collection
- `src/watchers/` — file system and junit output watchers
- `src/common.ts` — shared utility functions
- `src/settings.ts` — `WorkspaceSettings` class
- `src/_integrationTests/` — Mocha integration test suites (run inside VS Code)

## Rules
Path-specific instructions live in `.claude/rules/`. Claude loads them automatically based on file path.
