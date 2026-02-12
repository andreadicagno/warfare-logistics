# Supply Lines

Supply lines are the arteries of the logistics network, connecting facilities and enabling resource flow. They come in 5 levels, each with increasing capacity and visual complexity.

## Level 1: Trail

<!-- component: supply-line level=1 -->

| Property | Value |
|----------|-------|
| Capacity | 10 units/day |
| Build Time | 1 day |
| Visual | Dashed tan line |
| Color | `0xc2a66c` |
| Width | 2px |

Status: `[IMPLEMENTED]`

## Level 2: Road

<!-- component: supply-line level=2 -->

| Property | Value |
|----------|-------|
| Capacity | 25 units/day |
| Build Time | 3 days |
| Visual | Bordered road |
| Border | `0x4a3f2f` (5px) |
| Fill | `0xc2ae6c` (3px) |

Status: `[IMPLEMENTED]`

## Level 3: Dual Carriageway

<!-- component: supply-line level=3 -->

| Property | Value |
|----------|-------|
| Capacity | 60 units/day |
| Build Time | 5 days |
| Visual | Two parallel lanes |
| Color | `0x999999` |
| Width | 3px per lane |
| Offset | 2px |

Status: `[IMPLEMENTED]`

## Level 4: Railway

<!-- component: supply-line level=4 -->

| Property | Value |
|----------|-------|
| Capacity | 150 units/day |
| Build Time | 10 days |
| Visual | Rail with crossties |
| Border | `0x2a2a35` (5px) |
| Fill | `0x8888a0` (3px) |
| Tie Spacing | 10px |

Status: `[IMPLEMENTED]`

## Level 5: Logistics Corridor

<!-- component: supply-line level=5 -->

| Property | Value |
|----------|-------|
| Capacity | 400 units/day |
| Build Time | 15 days |
| Visual | Railway + road side by side |
| Corridor Offset | 3px |

Status: `[IMPLEMENTED]`

## Health States

Supply lines degrade under enemy action or overuse:

| State | Color | Effect |
|-------|-------|--------|
| Good | `0x4a8c3f` | Full capacity |
| Congested | `0xc8a832` | 75% capacity |
| Stressed | `0xb83a3a` | 50% capacity |
| Destroyed | `0x666666` | 0% capacity, 50% alpha |

## Bridges

When a supply line crosses a river hex, a bridge marker (`0x8b7355`) is drawn at the crossing point. Bridges are vulnerable to bombardment.
