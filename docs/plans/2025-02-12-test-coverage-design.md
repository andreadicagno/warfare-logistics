# Test Coverage Automation

## Goal

Add automatic test coverage checking to the `bun run check` quality gate, ensuring code coverage stays above a minimum threshold.

## Design

### Provider

Use **v8** via `@vitest/coverage-v8` — fast, zero-config, built on V8's native coverage instrumentation.

### Coverage Scope

**Include**: all `src/**/*.ts` files.

**Exclude** (no testable logic):
- `src/main.ts` — entry point, pure wiring
- `src/**/index.ts` — barrel exports
- `src/**/types.ts` — type definitions only
- `src/**/*.test.ts` — test files themselves
- `src/game/Game.ts` — app wiring/orchestration
- `src/ui/layers/**` — PixiJS rendering layers (require GPU mocking)
- `src/ui/MapRenderer.ts` — rendering orchestrator
- `src/ui/Sidebar.ts` — complex DOM/UI code
- `src/ui/DebugOverlay.ts` — debug rendering overlay
- `src/ui/KeyboardController.ts` — DOM event handling
- `src/ui/Camera.ts` — PixiJS-dependent camera system

### Thresholds

All metrics at **70%** minimum:
- Lines
- Functions
- Branches
- Statements

If any metric drops below 70%, the process exits with a non-zero code.

### Integration

The `check` script changes from:

```
biome check src/ && tsc --noEmit && vitest run
```

to:

```
biome check src/ && tsc --noEmit && vitest run --coverage
```

- `bun run test` — stays fast, no coverage (daily development)
- `bun run check` — full quality gate with coverage enforcement
- Pre-commit hook — unchanged (biome + tsc only, no tests)

### Dependencies

One new devDependency: `@vitest/coverage-v8`.

## Changes

| File | Change |
|---|---|
| `vitest.config.ts` | Add `coverage` block with provider, include/exclude, thresholds |
| `package.json` | Add `--coverage` to `check` script, add `@vitest/coverage-v8` devDependency |
