# Units

Military units are the consumers of supply. They are represented on the map using NATO-standard military symbols.

## Overview

<!-- component: unit-preview -->

| Type | Symbol | Movement | Fuel Use | Ammo Use |
|------|--------|----------|----------|----------|
| Infantry | X (diagonal cross) | Slow | Low | Medium |
| Armor | Diagonal slash | Fast | High | Medium |
| Artillery | Filled circle | Very Slow | Low | Very High |

Status: `[IMPLEMENTED]`

---

## Infantry

<!-- component: unit-preview type=infantry -->

Standard ground forces. High food consumption, moderate ammo usage.

| Property | Value |
|----------|-------|
| Symbol | X (diagonal cross) |
| Movement | Slow |
| Fuel Use | Low |
| Ammo Use | Medium |

Visual: Two diagonal lines crossing inside the NATO box, forming an X. Stroke width 1.5px, light color (`0xdddddd`).

## Armor

<!-- component: unit-preview type=armor -->

Mechanized forces. High fuel consumption, moderate ammo usage.

| Property | Value |
|----------|-------|
| Symbol | Diagonal slash |
| Movement | Fast |
| Fuel Use | High |
| Ammo Use | Medium |

Visual: Single diagonal line from bottom-left to top-right inside the NATO box. Stroke width 2px, light color (`0xdddddd`).

## Artillery

<!-- component: unit-preview type=artillery -->

Fire support units. Very high ammo consumption, low mobility.

| Property | Value |
|----------|-------|
| Symbol | Filled circle |
| Movement | Very Slow |
| Fuel Use | Low |
| Ammo Use | Very High |

Visual: Filled circle (6px radius) centered inside the NATO box. Light color (`0xdddddd`).

---

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
- Background: `0x333333`
- Pulsing animation when supply is low (< 40%: slow pulse, < 20%: fast pulse)
