# Units

Military units are the consumers of supply. They are represented on the map using NATO-standard military symbols.

## Unit Types

<!-- component: unit-preview -->

### Infantry

Standard ground forces. High food consumption, moderate ammo usage.

| Property | Value |
|----------|-------|
| Symbol | X (diagonal cross) |
| Movement | Slow |
| Fuel Use | Low |
| Ammo Use | Medium |

### Armor

Mechanized forces. High fuel consumption, moderate ammo usage.

| Property | Value |
|----------|-------|
| Symbol | Diagonal slash |
| Movement | Fast |
| Fuel Use | High |
| Ammo Use | Medium |

### Artillery

Fire support units. Very high ammo consumption, low mobility.

| Property | Value |
|----------|-------|
| Symbol | Filled circle |
| Movement | Very Slow |
| Fuel Use | Low |
| Ammo Use | Very High |

## Echelons

Echelons represent the size of a unit formation. Pips (marks) above the NATO box indicate echelon level.

| Echelon | Pips | Typical Strength |
|---------|------|-----------------|
| Battalion | (none) | 300-1000 |
| Regiment | I | 2000-5000 |
| Division | II | 10000-20000 |
| Corps | III | 30000-80000 |
| Army | IIII | 80000-200000 |

## Faction Colors

| Faction | Color | Alpha |
|---------|-------|-------|
| Allied | `0x3366aa` | 1.0 |
| Enemy | `0xaa3333` | 0.6 |

## Supply Bars

Allied battalions display 4 horizontal supply bars below their NATO box:
- Bar height: 4px, gap: 2px
- Colors: Fuel (`0xccaa22`), Ammo (`0x666666`), Food (`0x44aa44`), Parts (`0xcc8833`)

Status: `[IMPLEMENTED]`
