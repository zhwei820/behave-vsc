---
path: src/_integrationTests/
---

# Integration Tests

- Tests run inside a real VS Code instance via `@vscode/test-electron` — there is no unit test layer; all tests are integration tests
- Test runner uses Mocha with `ui: 'tdd'` (suite/test, not describe/it) and `bail: true` — a single failure stops the suite
- Each suite folder (e.g. `simple suite`, `project A suite`) targets a specific example project in `example-projects/`
- `TestWorkspaceConfig` / `TestWorkspaceConfigWithWkspUri` are injected via `TestSupport` to override workspace settings in tests — don't read `vscode.workspace.getConfiguration` directly in tests
- Suite setup typically calls `activate()` with a test config and waits on `featureParseComplete` before asserting
- `index.helper.ts` `runner()` function wires glob patterns to Mocha — add new suite folders there when creating new suites
