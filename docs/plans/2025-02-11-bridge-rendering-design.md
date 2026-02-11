# Bridge Rendering Design

## Context

When roads or railways cross river hexes, the UI currently draws a small brown rectangle (8x4 px) at hex center. This is a placeholder — it doesn't convey direction, structure, or scale of the crossing.

This design replaces the placeholder with a proper WW2-era Bailey bridge visual: a straight structural segment with vertical pillars and a deck, oriented along the route direction.

## Visual Structure

A bridge is composed of four graphic layers, bottom to top:

### 1. Pillars (vertical supports)

Gray-dark lines (`~0x555555`) extending downward from the deck into the river. They represent the bridge supports in water.

- **2-span bridges** (narrow rivers): 1 central pillar
- **3-span bridges** (wide/navigable rivers): 2 equally-spaced pillars

### 2. Deck (horizontal beam)

A rectangle in metallic gray (`~0x888888`) spanning the full width of the hex along the route direction. Slightly wider than the route line to suggest structural framing. This is the load-bearing surface.

### 3. Route surface

The road or railway line draws on top of the deck in its normal color:
- Roads: tan/brown (`0xc2ae6c` border, `0x8b7355` fill — existing palette)
- Railways: gray-blue (`0x2a2a35` border, `0x8888a0` fill — existing palette)

### 4. Railway crossties

If the route is a railway, crossties continue across the bridge deck with normal spacing.

## Orientation

The bridge aligns to the route direction through the river hex. If the road enters from the east edge and exits west, the bridge is horizontal.

The smooth Catmull-Rom spline that normally renders routes becomes a **straight segment** on bridge hexes. Bridges are rigid — they don't curve. The entry and exit points are where the route crosses the hex boundary.

## Adaptive Span Count

Span count adapts to river width using the existing `navigable` flag on river cells:

| River type | `navigable` | Spans | Pillars |
|---|---|---|---|
| Narrow (1 hex wide) | `false` | 2 | 1 (center) |
| Wide (2+ hex, navigable) | `true` | 3 | 2 (equally spaced) |

## Bridge Detection

A hex qualifies as a bridge when:
1. The hex has `TerrainType.River`
2. A route (road or railway) path includes this hex

This is the same logic as today — no new data structures needed.

## Rendering Order

Within `RouteLayer`, bridges render in this sequence:

1. Pillars — drawn first so they appear behind/below the deck
2. Deck — the structural beam
3. Route line — road or railway surface on top of deck
4. Crossties — railway ties on top (if railway)

Bridges draw after the normal route splines, on a higher layer, so the straight bridge segment overlays the curved spline beneath.

## Shared Style

Roads and railways use the same bridge structure (pillars + deck). Only the route surface color differs. This keeps the visual clean at small hex sizes (16px radius).

## Dimensions (approximate, to be tuned)

- **Deck width**: ~6px (slightly wider than route line at 3px)
- **Deck length**: edge-to-edge of the hex along route direction
- **Pillar height**: ~6px below deck
- **Pillar width**: ~2px
