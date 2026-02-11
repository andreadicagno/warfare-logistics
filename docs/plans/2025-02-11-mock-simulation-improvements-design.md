# Mock Simulation Visual Improvements — Design

## Context

The mock simulation creates a plausible-looking game state but needs visual improvements to feel more alive and realistic. All changes are to the mock/visual layer — no real gameplay mechanics.

## 1. Territory Overlay Gradient

### Problem
Territory overlay is flat 15% alpha — barely visible and doesn't convey front line intensity.

### Design
Calculate **distance from front line** for every hex using BFS from front-adjacent hexes. Map distance to alpha:

- Distance 0 (front): **45% alpha** — strong, contested feel
- Increasing distance: linear falloff
- Maximum distance (rear): **8% alpha** — barely tinted

Colors unchanged: blue `0x4488cc` (allied), red `0xcc4444` (enemy).

### Implementation
- BFS runs in `TerritoryLayer.build()` when version changes (~every 30s)
- Store `Map<string, number>` of hex key → normalized distance (0-1)
- Alpha formula: `0.45 - (distance * 0.37)` clamped to [0.08, 0.45]
- No frame-rate impact — same rebuild-on-version-change pattern

---

## 2. Hierarchical Military Organization

### Problem
8-12 flat units look sparse and unrealistic. Real WW2 fronts had dense, layered deployments.

### Structure
```
Army (1 per faction)
└── Corps (2-3 per army)
    └── Division (2-3 per corps)
        └── Regiment (2-3 per division)
            └── Battalion (2-4 per regiment)
```

Yields **~30-80 battalions per faction**.

### Positioning
- **Battalions** — first line, directly on hexes adjacent to front. Cover the entire front with no gaps.
- **Regiment HQ** — 2-3 hexes behind first line, centered in regiment sector
- **Division HQ** — 4-6 hexes behind, centered in division sector
- **Corps HQ** — 8-10 hexes behind
- **Reserves** — some battalions not on first line, 3-5 hexes behind as regimental reserve

### Sector Assignment
Front line is divided equally among corps, then each corps divides among divisions, then regiments. Each unit knows its sector boundaries.

### Visualization
- **Battalions** — small NATO icon (~14x10 px), type symbol inside (X for infantry, circle for armor, dot for artillery)
- **HQ symbols** — star or diamond, increasing size by echelon. Label with designation ("3rd Div", "II Corps")
- **Sector lines** — thin dashed semi-transparent lines between division areas of responsibility
- **Enemy** rendered at lower opacity (60%) as currently

### Supply Distribution
Supply levels follow hierarchy:
- Units close to supply hubs: well supplied
- Units far from hubs or in damaged-hub sectors: lower supply
- Reserve units: generally well supplied (not consuming as much)

---

## 3. Supply Hub Access Ramps

### Problem
Supply hubs float on the map with no visual connection to the road/railway network.

### Design
Each facility connects to its nearest road or railway with a short curved segment.

### Rules
- Facility **on a route hex**: no ramp needed (already connected)
- Facility **1-2 hexes from route**: draw access ramp
- Facility **>2 hexes**: no ramp (too far)

### Ramp Style
- Follows the style of the connected route (road texture for road, railway with crossties for railway)
- Slightly thinner than main route (~70% width)
- Bézier curve (not straight line) for natural look
- `railHub` always connects to railway if available; `depot` and `factory` connect to nearest road

### Implementation
- `MockSimulation` computes nearest-route data at setup
- Ramp data stored as extra route segments with type and endpoints
- `RouteLayer` renders ramps alongside normal routes

---

## 4. Supply Flow Particles (Hub → Troops)

### Problem
No visual indication of supply flowing from hubs to units. The logistics theme is invisible.

### Design
New `SupplyFlowLayer` shows arcing particles from supply hubs to troops within range.

### Supply Range
- `depot` / `railHub`: 8 hex radius
- `factory`: 5 hex radius

### Particle Flow (proportional to need)
Flow represents **current supply demand** — units that need more get more flow:

| Unit Supply Level | Particles | Speed | Meaning |
|---|---|---|---|
| 100% | 0 | — | Fully stocked, no deliveries needed |
| >80% | 1 | slow | Maintenance trickle |
| 20-80% | 2-3 | medium | Active resupply |
| <20% | 4-5 | fast | Emergency resupply, hub pumping max |

### Damaged Hubs
- Max flow reduced (cap at 2 particles regardless of demand)
- Particles slower
- Color shifts to **red** (`0xcc4433`) instead of gold

### Visual Style
- Particle size: 1.5px radius
- Color: **gold** `0xddaa33` at ~50% alpha (distinct from white traffic particles)
- Path: slight **parabolic arc** upward (not straight line) — gives "launch" feeling
- Speed scales inversely with distance (closer units get faster deliveries)

### Effect
Looking at the map, gold streams converge on crisis zones. Stable areas are quiet. Damaged hubs show choked, red trickles. The logistics situation reads at a glance.
