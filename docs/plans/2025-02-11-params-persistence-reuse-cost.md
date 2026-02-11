# Params Persistence & Route Reuse Cost

## Summary

Three changes to improve map generation workflow and route algorithm control:

1. **localStorage persistence** — Save generation params on Generate click, restore on app startup
2. **Default infrastructure = "developed"** — Change default from "none"
3. **Route reuse cost sliders** — Expose road/railway reuse costs to control segment minimization

## Changes

### 1. localStorage Persistence

- **Key**: `"supplyline:params"`
- **Save**: In `Game.onGenerate()`, after map generation, `JSON.stringify(params)` to localStorage
- **Load**: In `Game.init()`, check localStorage first. If found, parse and use those params; otherwise use `DEFAULT_GENERATION_PARAMS`
- **Flow**: Load params → `sidebar.setParams()` → `generateMap(params)`

### 2. Default Infrastructure

- `DEFAULT_GENERATION_PARAMS.roads.infrastructure`: `'none'` → `'developed'`

### 3. Route Reuse Cost

**New fields in `RoadParams`:**
- `roadReuseCost: number` (default 0.1, range 0.01–1.0, step 0.01)
- `railwayReuseCost: number` (default 0.1, range 0.01–1.0, step 0.01)

**Sidebar:** Two new sliders in the Roads section.

**RoadGenerator changes:**
- `existingEdges`: `Set<string>` → `Map<string, 'road' | 'railway'>`
- A* cost lookup: if edge exists and type matches what's being routed → use corresponding reuse cost
- If edge exists but type doesn't match (e.g., routing railway over existing road) → full terrain cost
- Lower reuse cost = more route sharing = fewer total segments

## Files Modified

| File | Change |
|------|--------|
| `src/core/map/types.ts` | Add `roadReuseCost`, `railwayReuseCost` to `RoadParams`; default infrastructure → `'developed'` |
| `src/core/map/RoadGenerator.ts` | `existingEdges` → `Map`, use typed reuse costs in A* |
| `src/ui/Sidebar.ts` | Two new sliders in Roads section |
| `src/game/Game.ts` | localStorage load/save in `init()` and `onGenerate()` |
