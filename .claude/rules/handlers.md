---
path: src/handlers/
---

# Handlers / VS Code Providers

- Handlers are thin — validate inputs, delegate heavy work to parsers or runners, surface results via `vscode.window` messages or `logger`
- Always guard with context checks (e.g. `isFeatureFile(docUri)`) before acting; these mirror `package.json` command availability contexts
- Use `waitOnReadyForStepsNavigation` / `parser.featureParseComplete` before any step-navigation logic — the parse tree is built asynchronously
- Show user-facing messages with `vscode.window.showInformationMessage` / `showWarningMessage` / `showErrorMessage`; keep them short
- Catch errors at handler boundaries with `try/catch` and call `logger.showError(e, wkspUri)` — don't let exceptions bubble to VS Code unhandled
- Providers (autocomplete, semantic highlight, format) implement VS Code provider interfaces and are registered in `extension.ts` — do not add registration logic inside the provider file itself
