# Map UI Overhaul — Design Document

## Summary

Three changes to the map system:
1. Render roads/railways as smooth Bezier curves instead of straight segments
2. Increase map sizes x5 and allow custom dimensions
3. Replace bottom toolbar with a collapsible sidebar exposing all ~45 generation parameters, with presets and sea-side selection

---

## 1. Road/Railway Curve Rendering

The route rendering changes from straight line segments between hex centers to smooth Catmull-Rom splines converted to Bezier curves.

### How it works
- Each route path (list of `HexCoord`) is converted to pixel coordinates (existing `HexGrid.toPixel`)
- A Catmull-Rom spline is fitted through all points, then converted to cubic Bezier segments
- Roads (dashed) become smooth dashed curves
- Railways (solid + crossties) follow the curve, with crossties perpendicular to the tangent
- Bridge indicators on river crossings remain functional

### What changes
- `RouteLayer.ts` — rewrite drawing logic to use Bezier curves
- `HexGrid.ts` or new utility — Catmull-Rom → Bezier conversion function
- No changes to pathfinding, road generation, or data structures

---

## 2. Map Sizes

### New preset dimensions (x5)
- **Small**: 200×150 = 30,000 cells
- **Medium**: 300×225 = 67,500 cells
- **Large**: 400×300 = 120,000 cells

### Custom dimensions
- Width and height freely adjustable via sliders (range 50–500)
- Selecting a size preset sets width/height to the preset values
- User can then adjust freely

---

## 3. Sea Side Selection

### Concept
The map is rectangular with 4 edges. Each edge can independently be sea or land.

### Control
A visual minimap rectangle in the sidebar. Each of the 4 sides is clickable to toggle sea/land. Active (sea) sides are highlighted blue, inactive (land) sides are dark.

### Generation impact
The `TerrainGenerator` center falloff is replaced with per-edge falloff:
- Sea edges: elevation drops to water level near that edge (existing falloff behavior)
- Land edges: elevation continues naturally to the border with no falloff
- Default: all 4 sides = sea (island, matches current behavior)

### Combinations
- 4 sea sides → island (current)
- 3 sea sides → peninsula
- 2 adjacent sea sides → corner coast
- 2 opposite sea sides → land corridor
- 1 sea side → single coastline
- 0 sea sides → fully continental (no ocean)

---

## 4. Sidebar UI

### Layout
- Right sidebar, ~300px wide, collapsible via a tab button on its left edge
- Bottom toolbar is removed entirely — all controls migrate to sidebar
- Dark semi-transparent background, consistent with debug overlay style
- **"Generate"** button pinned at top (always visible when sidebar is open)
- **"Reset Defaults"** button next to it

### Sections (accordion, expandable/collapsible)

#### 4.1 Presets
- Dropdown with built-in + custom presets
- "Save Preset" button → prompts for name, saves all parameters to localStorage
- "Delete" button for custom presets (with confirmation)
- Dropdown shows "Custom" when parameters diverge from selected preset

#### 4.2 Map Size
- Size preset dropdown (small / medium / large)
- Width slider + numeric input (range 50–500)
- Height slider + numeric input (range 50–500)
- Seed numeric input + randomize (dice) button

#### 4.3 Coastline
- Visual rectangle with 4 clickable sides
- Default: all sides = sea

#### 4.4 Terrain
| Parameter | Default | Range |
|---|---|---|
| Geography | mixed | plains / mixed / mountainous |
| Elevation Scale (large) | 0.05 | 0.01–0.2 |
| Elevation Scale (medium) | 0.1 | 0.02–0.4 |
| Elevation Scale (detail) | 0.2 | 0.04–0.8 |
| Noise Weight (large) | 60% | 0–100% |
| Noise Weight (medium) | 30% | 0–100% |
| Noise Weight (detail) | 10% | 0–100% |
| Center Falloff Strength | 2.0 | 0.5–5.0 |
| Moisture Scale | 0.08 | 0.01–0.3 |
| Water Threshold | 0.20 | 0.05–0.5 |
| Coastal Threshold | 0.35 | 0.1–0.6 |
| Lowland Threshold | 0.55 | 0.3–0.8 |
| Highland Threshold | 0.75 | 0.5–0.95 |
| Lake Moisture Threshold | 0.70 | 0.3–0.95 |

#### 4.5 Smoothing
| Parameter | Default | Range |
|---|---|---|
| Group Tolerance | 1 | 0–3 |
| Min Group Difference | 2 | 1–5 |

#### 4.6 Rivers
| Parameter | Default | Range |
|---|---|---|
| Min Sources | 3 | 1–20 |
| Max Sources | 5 | 1–30 |
| Source Min Elevation | 0.55 | 0.3–0.9 |
| Source Min Spacing | 5 | 1–15 |
| Min River Length | 3 | 1–10 |
| Wide River Min Length | 8 | 3–20 |
| Wide River Fraction | 0.6 | 0.0–1.0 |
| Lake Min Size | 3 | 1–10 |
| Lake Max Size | 6 | 2–20 |

#### 4.7 Settlements
| Parameter | Default | Range |
|---|---|---|
| City Density | 3/1200 | slider mapped to intuitive scale |
| Town Density | 8/1200 | slider mapped to intuitive scale |
| Min City Distance | 8 | 3–20 |
| Min Town Distance | 3 | 1–10 |
| River Bonus (city) | 3 | 0–10 |
| Water Bonus (city) | 2 | 0–10 |
| Plains Bonus (city) | 1 | 0–10 |

#### 4.8 Roads
| Parameter | Default | Range |
|---|---|---|
| Infrastructure | none | none / basic / developed |
| Plains Cost | 1 | 1–10 |
| Forest Cost | 2 | 1–10 |
| Hills Cost | 3 | 1–10 |
| Marsh Cost | 3 | 1–10 |
| River Cost (bridge) | 6 | 1–20 |
| City Connection Distance | 20 | 5–50 |

### Parameter controls
Each parameter has:
- Descriptive label
- Slider with appropriate range
- Numeric input beside it for precise values
- Default value indicated with a tick mark on the slider

---

## 5. Preset System

### Built-in presets (read-only)

| Preset | Description |
|---|---|
| **Default** | Current default values — the starting point |
| **Archipelago** | Low elevation, high moisture, many rivers, all sides sea |
| **Continental** | Large landmass, 0–1 sea sides, few rivers, many settlements |
| **Peninsula** | 3 sea sides, mixed terrain, good road network |
| **Mountain Fortress** | Mountainous geography, few isolated settlements, expensive roads |
| **River Delta** | Low terrain, many long wide rivers, large lakes, river settlements |

### Custom presets
- "Save Preset" button prompts for a name, saves all ~45 parameter values
- Stored in browser `localStorage`
- Can be deleted (with confirmation) or overwritten
- Selecting a preset loads all parameters + generates a new random seed
- Modifying any parameter after loading shows "Custom" in dropdown

---

## 6. What Does NOT Change

- Hex grid coordinate system (axial flat-top) — stays the same
- Pathfinding and road generation algorithms — stay the same
- River generation logic — stays the same, parameters become configurable
- Settlement placement logic — stays the same, parameters become configurable
- Map data structures (`GameMap`, `HexCell`, `RoutePath`) — stay the same
- Camera, selection, debug overlay — stay the same
