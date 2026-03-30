---
path: src/parsers/
---

# Parsers

- Module-level `Map`s (e.g. `featureFileSteps`) act as in-memory caches keyed by `uriId(uri)` — always scope keys with `uriId` so multi-root workspaces don't collide
- Exported regex constants (e.g. `featureFileStepRe`) are shared with handlers — don't inline duplicate patterns
- Parser state is mutable and workspace-scoped; provide paired `delete*` / `get*` functions to manage cache entries when files change
- `FileParser` coordinates async parse operations; callers must check `featureParseComplete` before consuming parsed data
- `WorkspaceSettings` is passed into parse functions, not read from `config` directly, to keep parsers testable
- `diagLog()` is acceptable for trace-level parsing events; don't use `logger.showError` inside parsers (let callers handle display)
