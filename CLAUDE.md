# Supply Line - Project Guide for Claude

## Overview

Supply Line is a logistics strategy game set in WW2 where the player manages the supply chain of a military theater. The player does not control combat - only logistics.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Build**: Vite
- **Rendering**: PixiJS

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
- Pre-commit hook runs `biome check` + `tsc --noEmit` automatically
- Test files are co-located as `*.test.ts` next to source files
- Config files: `biome.json`, `vitest.config.ts`, `lefthook.yml`

## Project Structure

```
src/
├── main.ts        # Entry point
├── core/          # Simulation logic (resources, flows, front)
├── game/          # Game loop, state management, events
├── ui/            # Rendering, panels, notifications
└── data/          # Types, configs, constants
```

## Architecture

### Path Aliases

- `@core/*` → `src/core/*`
- `@game/*` → `src/game/*`
- `@ui/*` → `src/ui/*`
- `@data/*` → `src/data/*`

### Core Concepts

1. **4 Resources**: Fuel, Ammo, Food, Parts
2. **Facilities**: Depots, Factories, Rail Hubs, Ports
3. **Vehicles**: Trucks, Trains (Ships, Planes post-MVP)
4. **Routes**: Roads, Railways (Sea, Air post-MVP)
5. **Flow System**: Automatic distribution based on network design

### Game Loop

1. Player designs network (facilities, routes)
2. Player builds/assigns vehicles
3. System calculates flows automatically
4. Front consumes resources based on state
5. Player reacts to disruptions (bombing, front movement)

## Design Document

Full game design in `docs/plans/2025-02-11-supply-line-design.md`

## Research Sources

Reference materials in `docs/sources/`:
- OpenFrontIO (cloned repo - architecture reference)
- Historical logistics analysis
- Game design resources
