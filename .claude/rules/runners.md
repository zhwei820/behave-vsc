---
path: src/runners/
---

# Runners

- `WkspRun` is the value object carrying all context for a single workspace test run — construct it once and pass it through
- Behave is invoked as a child process; use `vscode.TestRun` to report results (pass/fail/skip/enqueue) — never write directly to output channels from runner logic
- `run.appendOutput` requires `\r\n` line endings (Windows-style) for correct rendering in the VS Code test output panel
- Check `parser.featureParseComplete` at the top of `testRunHandler` before building the run queue
- `diagLog` is used for internal tracing; use `logger.logInfo(text, wkspUri, run)` for output the user should see
- Parallel run mode (per feature) and debug mode are mutually exclusive — enforce this at the runner level
