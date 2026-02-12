# Game Bible — Design Document

## Overview

A single source of truth for every game component in Supply Line — terrain, units, facilities, supply lines, resources, mechanics. Serves two audiences:

- **The user**: an interactive visual page at `/bible` with live PixiJS rendering and controls
- **Claude Code**: structured markdown files readable as development reference

Zero duplication — markdown files are the source of truth, the page reads and renders them.

## Architecture

### Markdown Files (`docs/bible/`)

```
docs/bible/
├── index.md              # Game overview, links to all categories
├── terrain.md            # Terrain types, elevation, moisture, costs
├── supply-lines.md       # 5 levels, capacity, routing, rendering
├── units.md              # Types, echelons, NATO symbols, supply status
├── facilities.md         # Depot, Factory, Rail Hub, Port
├── resources.md          # Fuel, Ammo, Food, Parts, flow system
├── mechanics.md          # Combat, interdiction, front dynamics, victory
├── factions.md           # Allied, Enemy, territories, colors
└── map-generation.md     # Generation pipeline, urban clusters, rivers
```

Each file follows a common template:

- **Overview** — What it is, role in the game
- **Components** — Detailed list of every element
- **Data Tables** — Numeric values (capacity, costs, hex colors)
- **Visual Specs** — UI appearance (colors, sizes, styles)
- **States** — Possible states (healthy, damaged, destroyed)
- **Status tags** — `[IMPLEMENTED]`, `[DESIGNED]`, `[CONCEPT]` per element

### Interactive Component Markers

Markdown files contain special markers where live rendering should appear:

```markdown
## Level 3 — Dual Carriageway

Two parallel gray lanes for heavy bidirectional traffic.

<!-- component: supply-line level=3 -->

| Property | Value    |
|----------|----------|
| Capacity | 60       |
| Color    | 0x999999 |

Status: `[IMPLEMENTED]`
```

The page replaces `<!-- component: ... -->` markers with interactive PixiJS canvases.

### Visual Page (`/bible`)

A dedicated page at `localhost:3000/bible/` — separate entry point from the game.

**Layout:**

- **Left sidebar** — Navigation by category (Terrain, Supply Lines, Units, etc.)
- **Main area** — Markdown content rendered as HTML, with interactive PixiJS canvases inline

**Flow:**

```
docs/bible/*.md  →  Vite raw import  →  marked parses to HTML  →  markers replaced with PixiJS canvases
```

### Source Files (`src/bible/`)

```
src/bible/
├── main.ts              # Entry point, sidebar routing
├── markdownLoader.ts    # Import .md, parse, mount components
├── components/          # Interactive PixiJS canvases
│   ├── TerrainPreview.ts
│   ├── SupplyLinePreview.ts
│   ├── UnitPreview.ts
│   ├── FacilityPreview.ts
│   ├── ResourcePreview.ts
│   ├── FactionPreview.ts
│   └── MapGenPreview.ts
└── styles.css           # Page layout and styling
```

### Vite Configuration

- Multi-page setup: `bible/index.html` as second entry point in `build.rollupOptions.input`
- Markdown imported as raw strings via `?raw` suffix
- In dev: `localhost:3000/bible/`
- Shares path aliases (`@core/*`, `@ui/*`, etc.) with main app

## Interactive Components

### Terrain

- Grid of 8 hexes, one per terrain type
- Controls: toggle color variation, toggle pattern overlay
- Data: base hex color, elevation range, moisture range, movement cost

### Supply Lines

- 5 canvases, one per level (Trail → Logistics Corridor)
- Each shows a curved segment with hex context on sides
- Controls: health slider (good / congested / stressed / destroyed), bridge toggle
- Data: capacity, line width, colors, style (dash, solid, double, crossties)

### Units

- Canvas with NATO symbol
- Controls: type dropdown (Infantry / Armor / Artillery), echelon dropdown (Battalion → Army), faction dropdown, supply status slider per resource
- Data: box dimensions, faction colors, type icons

### Facilities

- Canvas with facility icon
- Controls: type dropdown (Depot / Factory / Rail Hub / Port), damage slider, storage slider per resource
- Data: dimensions, colors, icons

### Resources

- Colored bars for 4 resources
- Controls: quantity slider per resource
- Data: color, icon, role in game

### Factions

- Canvas with colored hex territory + front line
- Controls: territory overlay toggle, front line toggle
- Data: faction colors, border styles

### Map Generation

- Mini-map generated with fixed seed
- Controls: sliders for key parameters (map size, water level, forest density)
- Shows how parameters affect the result

## Implementation Plan

### Phase 1 — Foundation

- Vite multi-page setup with `/bible` entry point
- Page layout (sidebar + content area) with CSS
- Markdown loader: import `.md` files, parse with `marked`, render HTML
- Marker system: `<!-- component: ... -->` → mount PixiJS container
- Write `index.md` with game overview and category links

### Phase 2 — Priority Content

- `terrain.md` + `TerrainPreview.ts` — simplest, good proving ground
- `supply-lines.md` + `SupplyLinePreview.ts` — most requested, 5 levels with interactivity
- `facilities.md` + `FacilityPreview.ts`

### Phase 3 — Full Content

- `units.md` + `UnitPreview.ts`
- `resources.md` + `ResourcePreview.ts`
- `factions.md` + `FactionPreview.ts`
- `map-generation.md` + `MapGenPreview.ts`
- `mechanics.md` (text only, no canvas — game rules)

## Content Completeness

Each markdown file consolidates information from:

- Existing design documents in `docs/plans/`
- Type definitions in source code (`src/core/map/types.ts`, `src/data/types.ts`)
- Rendering specs from layer implementations (`src/ui/layers/`)

Every element is tagged with implementation status:

- `[IMPLEMENTED]` — In the codebase, working
- `[DESIGNED]` — Specified in design docs, not yet built
- `[CONCEPT]` — Idea only, needs design work
