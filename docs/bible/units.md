# Units

Military units are the consumers of supply. They are represented on the map using NATO-standard military symbols. The player does not control them — they fight and move automatically.

## Overview

<!-- component: unit-preview -->

| Type | Symbol | Fuel/day | Ammo/day | Food/day |
|------|--------|----------|----------|----------|
| Infantry | X (diagonal cross) | 2 | 5 | 8 |
| Armor | Diagonal slash | 10 | 5 | 6 |
| Artillery | Filled circle | 2 | 12 | 4 |

These are base consumption rates in **standby** state. See State Multipliers below.

Status: `[DESIGN COMPLETE]`

---

## Infantry

<!-- component: unit-preview type=infantry -->

Standard ground forces. High food consumption, moderate ammo usage.

| Property | Value |
|----------|-------|
| Symbol | X (diagonal cross) |
| Fuel/day | 2 |
| Ammo/day | 5 |
| Food/day | 8 |

Visual: Two diagonal lines crossing inside the NATO box, forming an X. Stroke width 1.5px, light color (`0xdddddd`).

## Armor

<!-- component: unit-preview type=armor -->

Mechanized forces. High fuel consumption, moderate ammo usage.

| Property | Value |
|----------|-------|
| Symbol | Diagonal slash |
| Fuel/day | 10 |
| Ammo/day | 5 |
| Food/day | 6 |

Visual: Single diagonal line from bottom-left to top-right inside the NATO box. Stroke width 2px, light color (`0xdddddd`).

## Artillery

<!-- component: unit-preview type=artillery -->

Fire support units. Very high ammo consumption, low mobility.

| Property | Value |
|----------|-------|
| Symbol | Filled circle |
| Fuel/day | 2 |
| Ammo/day | 12 |
| Food/day | 4 |

Visual: Filled circle (6px radius) centered inside the NATO box. Light color (`0xdddddd`).

---

## State Multipliers

Unit state is determined automatically by the combat simulation. Multipliers apply to base consumption.

| State | Fuel | Ammo | Food |
|-------|------|------|------|
| **Standby** | 1x | 1x | 1x |
| **Active Defense** | 1.5x | 3x | 1x |
| **Movement** | 4x | 0.5x | 1x |
| **Attack** | 3x | 5x | 1.5x |
| **Retreat** | 3x | 0.5x | 0.5x |

**Example**: Armor division in Attack state = 10×3=30 Fuel, 5×5=25 Ammo, 6×1.5=9 Food per day.

## Echelons

Echelons represent the size of a unit formation. Pips (marks) above the NATO box indicate echelon level. The echelon multiplier applies to all consumption rates.

| Echelon | Pips | Multiplier | Typical Strength |
|---------|------|-----------|-----------------|
| Battalion | (none) | 1x | 300-1000 |
| Regiment | I | 3x | 2000-5000 |
| Division | II | 10x | 10000-20000 |
| Corps | III | 30x | 30000-80000 |

## Terrain

Units **cannot** occupy or cross Water or Mountain hexes.

## Faction Colors

| Faction | Color | Alpha |
|---------|-------|-------|
| Allied | `0x3366aa` | 1.0 |
| Enemy | `0xaa3333` | 0.6 |

## Supply Bars

Allied units display 3 horizontal supply bars below their NATO box:
- Bar height: 4px, gap: 2px
- Colors: Fuel (`0xccaa22`), Ammo (`0x666666`), Food (`0x44aa44`)
- Background: `0x333333`
- Pulsing animation when supply is low (< 40%: slow pulse, < 20%: fast pulse)
