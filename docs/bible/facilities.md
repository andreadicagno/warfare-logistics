# Facilities

Facilities are the nodes of the supply network. 2 types: **Factory** (produces resources) and **Depot** (stores and distributes). Both upgradable to 5 levels.

## Factory

<!-- component: facility-preview type=factory -->

Produces a single resource type. 4 subtypes: Fuel Factory, Ammo Factory, Food Factory, Construction Parts Factory. Production is direct — no inputs required.

**Economies of scale**: higher levels are more CP-efficient per unit of production, but concentrate risk (single point of failure if bombed).

| Level | Production/day | Upgrade Cost (CP) | Total CP Invested | CP per unit prod. | Upgrade Time |
|-------|----------------|---------------------|---------------------|---------------------|--------------|
| 1 | 10 | 20 (build) | 20 | 2.00 | 2 days |
| 2 | 25 | 25 | 45 | 1.80 | 3 days |
| 3 | 50 | 30 | 75 | 1.50 | 4 days |
| 4 | 85 | 35 | 110 | 1.29 | 6 days |
| 5 | 130 | 40 | 150 | 1.15 | 8 days |

| Property | Value |
|----------|-------|
| Icon | Gear (circle + spokes) |
| Placement | Urban hex or adjacent to Urban hex |
| Upgrade | Factory **stopped** during upgrade (no production) |
| Damage | Reduces throughput by a percentage. Repair costs CP + time proportional to damage |

**Design tension**: 1× lv5 factory (130/day for 150 CP = 1.15 CP/unit) vs 3× lv1 factories (30/day for 60 CP = 2.00 CP/unit). The lv5 is twice as efficient — but one bomb takes it all out.

Status: `[DESIGN COMPLETE]`

## Depot

<!-- component: facility-preview type=depot -->

Stores resources and distributes them to units within range. The link between the logistics network and the front line.

| Level | Storage (per resource) | Throughput/day | Range (hex) | Max per unit/day | Cost (CP) | Build Time |
|-------|------------------------|----------------|-------------|------------------|-----------|------------|
| 1 | 50 | 60 | 5 | 5 | 15 | 1 day |
| 2 | 100 | 120 | 7 | 8 | 30 | 2 days |
| 3 | 180 | 200 | 9 | 12 | 50 | 3 days |
| 4 | 280 | 300 | 11 | 16 | 75 | 5 days |
| 5 | 400 | 420 | 13 | 20 | 105 | 7 days |

| Property | Value |
|----------|-------|
| Icon | Cross (+) |
| Placement | Any passable hex (not Water, not Mountain) |
| Storage | Per each of the 3 consumable resources (Fuel, Ammo, Food). CP does not transit through depots |
| Upgrade | Depot **stopped** during upgrade (no distribution). Stock remains inside |
| Damage | Reduces throughput by a percentage. Stock is not lost (resources exit slower) |

### Distribution Algorithm

1. Each unit in range receives resources with **distance decay** — further away = less delivered (down to 0 at range limit)
2. **Per-unit cap** per day (column "Max per unit/day")
3. **Total throughput cap** per day — if total demand exceeds the cap, all deliveries scale down linearly
4. Each unit **auto-assigns** to the depot that can provide the most

**Example**: Depot lv3, throughput 200/day, max per unit 12/day.
- 10 units at distance 2 → can receive up to 12/day each = 120 potential
- 10 units at distance 7 → can receive up to 5/day each = 50 potential
- Total potential: 170. Under the 200 cap → each unit gets its distance-adjusted max
- If total exceeded 200, all deliveries would scale linearly

Status: `[DESIGN COMPLETE]`

## Resource Bars

Each facility displays resource bars above its icon:
- Bar width: 4px, height: 20px
- Colors: Fuel (`0xccaa22`), Ammo (`0x666666`), Food (`0x44aa44`), Construction Parts (`0xcc8833`)
- Background: `0x333333`

## Damage

Facilities can be damaged by enemy bombardment. A damaged facility shows a red X overlay (`0xcc3333`, alpha 0.7) and operates at reduced capacity until repaired. Repair costs Construction Parts and time proportional to damage.
