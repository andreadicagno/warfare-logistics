# Supply Line

A logistics strategy game set in World War 2 where the player manages the supply chain of a military theater. You don't control combat — only logistics.

Built with TypeScript, PixiJS v8, and procedural hex-based map generation.

**[Play it live](https://andreadicagno.github.io/warfare-logistics/)**

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+

### Install & Run

```bash
bun install
bun run dev
```

The dev server starts at `http://localhost:3000`.

### Controls

| Key | Action |
|-----|--------|
| Mouse drag | Pan the map |
| Scroll wheel | Zoom in/out |
| Space | Pause/resume simulation |
| F3 | Toggle debug overlay |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Production build |
| `bun run preview` | Preview production build |
| `bun run check` | Run all quality gates (lint + typecheck + test) |
| `bun run test` | Run tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run format:fix` | Auto-fix formatting |

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Build**: Vite
- **Rendering**: PixiJS v8
- **Procedural generation**: simplex-noise
- **Linter/Formatter**: Biome v2
- **Tests**: Vitest
- **Git hooks**: Lefthook

## Project Structure

```
src/
├── main.ts              # Entry point
├── core/                # Simulation logic (pure, no rendering)
│   ├── map/             # Map generation pipeline
│   │   ├── HexGrid.ts           # Flat-top axial hex utilities
│   │   ├── MapGenerator.ts      # Generation orchestrator
│   │   ├── TerrainGenerator.ts  # Elevation/moisture → terrain
│   │   ├── RiverGenerator.ts    # River flow system
│   │   ├── RoadGenerator.ts     # Road network
│   │   ├── UrbanGenerator.ts    # Urban terrain generation
│   │   └── SupplyHubPlacer.ts   # Supply hub placement
│   └── mock/            # Mock simulation for prototyping
├── game/
│   └── Game.ts          # Main game orchestrator
├── ui/                  # Rendering & UI layer
│   ├── Camera.ts        # Pan/zoom camera
│   ├── MapRenderer.ts   # Render orchestration
│   ├── Sidebar.ts       # Generation params & layer toggles
│   └── layers/          # Composable render layers
│       ├── TerrainLayer.ts
│       ├── RouteLayer.ts
│       ├── SupplyHubLayer.ts
│       ├── TerritoryLayer.ts
│       ├── FrontLineLayer.ts
│       └── ...
└── data/
    └── types.ts         # Game-level data types
```

## Architecture

- **Hex grid**: Flat-top axial coordinate system (q, r)
- **Layer rendering**: Each layer builds geometry once and caches it — PixiJS handles viewport clipping on GPU
- **Pure core**: Simulation logic in `core/` has zero rendering dependencies
- **Seeded RNG**: All procedural generation is deterministic and reproducible
- **Path aliases**: `@core/*`, `@game/*`, `@ui/*`, `@data/*`

## Design Goals

- 4 resource types: Fuel, Ammo, Food, Parts
- Facilities: Depots, Factories, Rail Hubs, Ports
- Vehicles: Trucks, Trains (Ships, Planes post-MVP)
- Routes: Roads, Railways (Sea, Air post-MVP)
- Automatic supply distribution based on network topology

## License

MIT
