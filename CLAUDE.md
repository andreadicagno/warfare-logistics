# Supply Line - Project Guide for Claude

## Working Mode

The user is **not a developer**. All development is done by Claude Code (Opus 4.6). Claude makes all technical decisions autonomously — implementation approach, architecture, naming, patterns. Ask the user only about game design intent and high-level preferences, never about technical choices.

## Overview

Supply Line is a logistics strategy game set in WW2 where the player manages the supply chain of a military theater. The player does not control combat — only logistics.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Build**: Vite
- **Rendering**: PixiJS v8
- **Noise**: simplex-noise v4
- **Linter/Formatter**: Biome v2
- **Tests**: Vitest

## Commands

```bash
bun run dev      # Start development server (port 3000)
bun run build    # Build for production
bun run preview  # Preview production build
bun run typecheck # Run TypeScript type checking
```

## Quality Commands

```bash
bun run lint       # Check linting (Biome)
bun run lint:fix   # Fix lint issues automatically
bun run format     # Check formatting (Biome)
bun run format:fix # Fix formatting automatically
bun run test       # Run tests once (Vitest)
bun run test:watch # Run tests in watch mode
bun run check      # Run ALL quality gates (lint + typecheck + test)
```

### Quality Workflow

- Run `bun run check` before committing — validates lint, types, and tests
- Pre-commit hook runs `biome check` + `tsc --noEmit` automatically (via lefthook)
- Config files: `biome.json`, `vitest.config.ts`, `lefthook.yml`

## Development Principles

- Prefer elegant, well-crafted solutions — invest in clean design and proper abstractions
- Write modular code: small functions, single responsibility, clear interfaces
- Favor composition over inheritance
- Keep modules loosely coupled — depend on interfaces/types, not concrete implementations
- Name things precisely — code should read like prose
- Extract shared logic only when used in 3+ places; premature abstraction is worse than duplication
- Every module should be independently testable
- Pure functions where possible — isolate side effects at boundaries

## Code Style

Enforced by Biome — do not override:

- Single quotes, semicolons always, trailing commas
- 2-space indent, 100 char line width
- Arrow parens always: `(x) => x`
- `const` over `let` (error), `forEach` allowed, `any` warned

## Project Structure

```
src/
├── main.ts                  # Entry point (creates PixiJS app + Game)
├── core/                    # Simulation logic (pure, no rendering)
│   ├── index.ts             # Barrel export
│   └── map/
│       ├── types.ts             # HexCoord, HexCell, TerrainType, GameMap, MapConfig
│       ├── HexGrid.ts           # Flat-top axial hex grid utilities (static class)
│       ├── MapGenerator.ts      # Orchestrates full map generation pipeline
│       ├── TerrainGenerator.ts  # Elevation/moisture → terrain assignment
│       ├── SmoothingPass.ts     # Post-processing terrain smoothing
│       ├── RiverGenerator.ts    # Greedy downhill river flow
│       ├── RoadGenerator.ts     # Road network between settlements
│       ├── SettlementPlacer.ts  # Town/city placement logic
│       ├── rng.ts               # Seeded random number generator
│       └── __tests__/           # Unit tests for map module
├── game/
│   ├── Game.ts              # Main game class
│   └── index.ts             # Barrel export
├── ui/                      # Rendering & UI layer
│   ├── index.ts             # Barrel export
│   ├── Camera.ts            # Pan/zoom camera system
│   ├── MapRenderer.ts       # Orchestrates map rendering
│   ├── HexRenderer.ts       # Hex tile rendering utilities
│   ├── DebugOverlay.ts      # Dev debug info overlay
│   ├── GeneratorToolbar.ts  # Map regeneration controls
│   ├── layers/              # Composable render layers
│   │   ├── TerrainLayer.ts
│   │   ├── RiverLayer.ts
│   │   ├── RouteLayer.ts
│   │   ├── SupplyHubLayer.ts
│   │   └── SelectionLayer.ts
│   ├── Sidebar.ts             # Generation params sidebar with layer toggles
│   ├── KeyboardController.ts  # Keyboard input handling
│   └── __tests__/           # UI unit tests
└── data/
    ├── types.ts             # Game-level types (resources, facilities — stubs)
    └── types.test.ts        # Co-located test
```

### Test Placement

Two patterns exist — both are fine:
- `__tests__/Foo.test.ts` — subdirectory (used in `core/map/`)
- `Foo.test.ts` — co-located next to source (used in `data/`)

## Architecture

### Path Aliases

- `@core/*` → `src/core/*`
- `@game/*` → `src/game/*`
- `@ui/*` → `src/ui/*`
- `@data/*` → `src/data/*`

Defined in both `tsconfig.json` (paths) and `vite.config.ts` (alias). Vitest inherits aliases via `mergeConfig` from vite config.

### Current Implementation

Map generation pipeline (hex grid → terrain → smoothing → rivers → roads → settlements) with seeded RNG. Full rendering system with camera, composable layer architecture, debug overlay, and generator toolbar.

### Design Goals (not yet built)

- 4 Resources: Fuel, Ammo, Food, Parts
- Facilities: Depots, Factories, Rail Hubs, Ports
- Vehicles: Trucks, Trains (Ships, Planes post-MVP)
- Routes: Roads, Railways (Sea, Air post-MVP)
- Flow System: Automatic distribution based on network design

## Gotchas

- **Rendering perf**: All layers build geometry once and cache it (`built` flag). Never rebuild on camera move — PixiJS handles viewport clipping on GPU. New layers must follow this pattern.
- **Wiring**: `Game.ts` coordinates UI components (MapRenderer, DebugOverlay, Sidebar). Callbacks flow: Sidebar → Game → MapRenderer.
- **PixiJS v8**: API differs significantly from v7. Use `new Application()` + `await app.init()`, not constructor options. `Graphics` uses method chaining (`fill()`, `stroke()`), not `beginFill/endFill`.
- **Biome v2**: Config syntax differs from v1 — see `biome.json` for working config. Schema version must match installed CLI version.
- **Hex coordinate system**: Flat-top axial (q, r). Edge indices 0-5 clockwise from east. `HexGrid` is a static utility class.

## Design Documents

All in `docs/plans/`:
- `2025-02-11-supply-line-design.md` — Full game design
- `2025-02-11-map-generation-design.md` — Map generation design
- `2025-02-11-map-generation-implementation.md` — Map generation implementation plan
- `2025-02-11-map-visualization-design.md` — Map visualization UI design
- `2025-02-11-map-visualization-implementation.md` — Map visualization implementation plan
- `2025-02-11-river-lake-redesign-design.md` — River & lake system redesign
- `2025-02-11-ui-debug-toolbar-design.md` — Debug overlay & generator toolbar design

## Research Sources

Reference materials in `docs/sources/`:
- OpenFrontIO (cloned repo — architecture reference)
- Historical logistics analysis documents
- Game design resources
