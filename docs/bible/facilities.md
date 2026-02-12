# Facilities

Facilities are the nodes of the supply network. They store resources, produce goods, and serve as transfer points for the logistics chain.

## Facility Types

<!-- component: facility-preview -->

### Depot

The basic storage facility. Depots receive resources from the supply chain and distribute them to nearby units.

| Property | Value |
|----------|-------|
| Icon | Cross (+) |
| Storage | High |
| Throughput | Medium |
| Build Time | 3 days |

### Factory

Produces one resource type from raw materials. Factories require a steady supply of parts and fuel to operate.

| Property | Value |
|----------|-------|
| Icon | Gear (circle + spokes) |
| Production | 1 resource type |
| Input | Parts + Fuel |
| Build Time | 7 days |

### Rail Hub

A high-throughput transfer station that connects railway lines. Essential for long-distance supply chains.

| Property | Value |
|----------|-------|
| Icon | Parallel tracks + crossties |
| Storage | Low |
| Throughput | Very High |
| Build Time | 5 days |

### Port

Coastal facility for sea-based supply. Connects land and sea routes.

| Property | Value |
|----------|-------|
| Icon | Anchor |
| Storage | High |
| Throughput | High |
| Build Time | 10 days |

Status: `[PARTIALLY IMPLEMENTED]` — Port not yet in game

## Damage

Facilities can be damaged by enemy bombardment. A damaged facility shows a red X overlay (`0xcc3333`, alpha 0.7) and operates at reduced capacity until repaired.

## Resource Bars

Each facility displays 4 vertical resource bars above its icon:
- Bar width: 4px, height: 20px
- Colors: Fuel (`0xccaa22`), Ammo (`0x666666`), Food (`0x44aa44`), Parts (`0xcc8833`)
- Background: `0x333333`
