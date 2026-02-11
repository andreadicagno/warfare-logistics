# Supply Line System Design

## Overview

Unify the current separate road/railway systems into a single **Supply Line** concept with 5 upgradeable levels. Each level has distinct visual identity, increasing capacity, and different vehicle types. Traffic visualization is organic — line thickness and vehicle density reflect actual resource flow.

## Core Concept

A Supply Line is a connection between two points on the map. It has a level (1-5) that determines its capacity, visual appearance, and the type of vehicles that travel on it. The player invests resources and time to upgrade lines, creating a strategic layer around infrastructure development.

## Data Model

### SupplyLine

| Field | Type | Description |
|-------|------|-------------|
| hexes | HexCoord[] | Sequence of hexes the line traverses |
| level | 1-5 | Current infrastructure level |
| state | `active` \| `upgrading` \| `building` | Current operational state |
| buildProgress | 0.0 - 1.0 | Construction/upgrade completion (1.0 = done) |
| flow | number | Current resource throughput |
| capacity | number | Maximum throughput at current level |

### Capacity Table

Progression follows a ~2.5x multiplier per level:

| Level | Name | Capacity | Upgrade Cost |
|-------|------|----------|-------------|
| 1 | Trail | 10 | — (base) |
| 2 | Road | 25 | Low |
| 3 | Dual Carriageway | 60 | Medium |
| 4 | Railway | 150 | High |
| 5 | Logistics Corridor | 400 | Very High |

### Saturation

`saturation = flow / capacity` (0.0 - 1.0)

Saturation drives all visual feedback: line thickness and vehicle density.

### Construction States

- **active**: Fully operational at current level capacity.
- **building**: New line under construction. Capacity is **0** until complete.
- **upgrading**: Existing line being upgraded. Capacity drops to **50%** of current level during works.

### Constraints

- Levels cannot be skipped. Upgrading from Lv1 to Lv5 requires four separate upgrades (1→2→3→4→5).
- Upgrade/build time scales with line length and target level.

## Visual Design

Each level has a distinct visual identity recognizable at a glance. Line thickness reacts dynamically to saturation.

### Level 1 — Trail

- Dashed thin line, light brown/earth color
- High saturation: dashes tighten, line thickens slightly
- Vehicles: sparse single trucks, slow

### Level 2 — Road

- Solid continuous line, grey-brown with dark border
- Thicker than trail, "paved" appearance
- High saturation: line widens noticeably
- Vehicles: trucks, more frequent

### Level 3 — Dual Carriageway

- Two parallel lines with central divider
- Asphalt grey color
- High saturation: dense traffic on both lanes, lines expand
- Vehicles: trucks in both directions simultaneously

### Level 4 — Railway

- Rails with perpendicular crossties (sleepers)
- Metallic grey/steel color
- High saturation: rails expand, crossties more dense
- Vehicles: trains (longer and faster than trucks)

### Level 5 — Logistics Corridor

- Double railway track + road side by side (maximum infrastructure)
- Combined visual: crossties + asphalt
- High saturation: full corridor, mixed train and truck traffic
- Vehicles: trains on rails + trucks on road, maximum density

### Dynamic Thickness

Base width per level is multiplied by `1.0 + saturation * 0.4`. At full load, a line is 40% wider than at rest. The effect is subtle but readable at map scale.

### Construction State Rendering

Lines in `building` or `upgrading` state render as:
- Dashed outline with muted/desaturated colors
- Visually distinct from active lines
- Communicates "not yet fully operational"

## Map Generation

### Initial Network

The existing MST + A* generation logic is preserved. Changes:
- Output is a single `supplyLines[]` array instead of separate `roads[]` + `railways[]`
- All generated lines start at **Level 1** (trails)
- Connection logic unchanged: major centers via MST, secondary connections, town branch lines

### Player Construction

- Player selects a start hex (must be on existing line or settlement) and a destination hex
- System calculates optimal path via A* with terrain-aware costs (same as current generation)
- New line enters `building` state with capacity 0
- Once complete, becomes active Lv1

### Player Upgrade

- Player selects an existing active line and chooses "upgrade"
- Line enters `upgrading` state — capacity halved for duration
- Construction time scales with line length and target level
- On completion, returns to `active` at new level

## Impact on Existing Code

### Types (`types.ts`)

- Remove `RoutePath.type: 'road' | 'railway'`
- Add `SupplyLine` type with level, state, buildProgress, flow, capacity
- Replace `GameMap.roads[]` + `GameMap.railways[]` with `GameMap.supplyLines[]`
- Simplify `RoadParams` — no road vs railway distinction needed

### Generation (`RoadGenerator.ts`)

- Rename to `SupplyLineGenerator.ts`
- Internal MST + A* logic unchanged
- Output changes from `{ roads, railways }` to `SupplyLine[]` all at Lv1

### Rendering (`RouteLayer.ts`)

- Rename to `SupplyLineLayer.ts`
- Replace two fixed styles with five level-based rendering modes
- Add dynamic thickness based on saturation
- Add construction state rendering (dashed + muted)
- Spline system (Catmull-Rom → Bezier) unchanged
- Remove shared-edge offset logic (no more road/railway overlap)

### Vehicles (`VehicleLayer.ts`)

- Vehicle type determined by line level: Lv1-3 → trucks, Lv4-5 → trains (Lv5 also has trucks)
- Vehicle count proportional to saturation
- Single index into `supplyLines[]` instead of separate road/railway indices

### Flow (`FlowLayer.ts`)

- Particle density reflects saturation
- No structural changes — follows same splines

### Simulation (`MockSimulation.ts`)

- Simplify: single route state array instead of separate road/railway states
- Health/state tracked per supply line

## What We're NOT Building (YAGNI)

- No degradation/maintenance system
- No per-level maintenance costs
- No enemy destruction of lines
- No specific resource types for construction (generic cost for now)
- No sea lanes or air routes (post-MVP)

## Summary of Decisions

| Decision | Choice |
|----------|--------|
| Number of levels | 5 (trail → logistics corridor) |
| Capacity scaling | Progressive multiplier ~2.5x |
| Upgrade mechanic | Construction time, capacity -50% during works |
| Initial network | Generated at Lv1 + free player construction |
| Visual identity | Distinct character per level |
| Traffic feedback | Vehicles + dynamic line thickness |
| Level skipping | Not allowed (sequential 1→2→3→4→5) |
