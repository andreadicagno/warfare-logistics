# Factions

The battlefield is divided between two factions: Allied (player) and Enemy (AI). Territory control determines the flow of the front line.

## Factions

<!-- component: faction-preview -->

### Allied

The player's faction. Controls the logistics network, supply chain decisions, and facility placement.

| Property | Value |
|----------|-------|
| Color | `0x4488cc` (blue) |
| Territory Alpha | 0.6 at front, gradient to 0.1 |
| Unit Alpha | 1.0 |
| Role | Player-controlled logistics |

### Enemy

The AI-controlled opposing force. Pushes the front line based on combat resolution and supply state.

| Property | Value |
|----------|-------|
| Color | `0xcc4444` (red) |
| Territory Alpha | 0.6 at front, gradient to 0.1 |
| Unit Alpha | 0.6 |
| Role | AI-controlled combat |

## Territory Overlay

Each hex in controlled territory gets a colored overlay based on faction ownership. The overlay alpha decreases with distance from the front line:
- **At front**: alpha 0.6
- **Per hex away**: decreases by ~0.07
- **Minimum**: alpha 0.1

Water and mountain hexes are excluded from territory overlay.

## Front Line

The front line is drawn as a white border (`0xffffff`) with a dark outline (`0x222222`) along the boundary between Allied and Enemy territory. Edge segments are chained into connected polylines for smooth rendering.

| Property | Value |
|----------|-------|
| Line Color | `0xffffff` |
| Border Color | `0x222222` |
| Line Width | 3px |
| Border Width | 5px |

Status: `[IMPLEMENTED]`
