# Supply Lines

Supply lines are abstract logistics infrastructure built **hex-by-hex** on the map. They form a branching network with forks and intersections. Resources travel through them as **physical particles** with real transit time.

## Levels

| Level | Capacity/day | Speed (hex/hr) | Cost CP/hex | Build Time/hex |
|-------|-------------|----------------|-------------|----------------|
| 1 | 30 | 5 | 5 | 4 hours |
| 2 | 80 | 8 | 15 | 8 hours |
| 3 | 180 | 12 | 30 | 16 hours |
| 4 | 350 | 17 | 50 | 1 day |
| 5 | 600 | 24 | 80 | 2 days |

Status: `[DESIGN COMPLETE]`

## Construction

- **Hex-by-hex**: the player traces a path on the map. Each hex crossed costs CP/hex of the chosen level. An 8-hex line at lv2 = 8 × 15 = 120 CP
- **Branching network**: forks and intersections are free. Nodes where branches meet distribute flow automatically
- **Terrain cost**: River hex costs **2x CP** (bridge required). Hills hex costs **1.5x CP**
- **Placement**: passable hexes only (not Water, not Mountain)

## Transit Time

Resources take real time to travel. They are **in transit** inside the supply line — a real pipeline.

| Example | Distance | Level | Speed | Transit Time |
|---------|----------|-------|-------|-------------|
| Short haul | 20 hex | lv3 | 12 hex/hr | 1.7 hours |
| Medium haul | 60 hex | lv3 | 12 hex/hr | 5 hours |
| Long haul | 60 hex | lv1 | 5 hex/hr | 12 hours |
| Express haul | 60 hex | lv5 | 24 hex/hr | 2.5 hours |

## Bottlenecks

In a network with mixed-level segments, the effective capacity is that of the **weakest segment** along the path. The slowest segment's speed slows transit through that section.

## Upgrade

Individual segments or entire stretches can be upgraded. During upgrade, the segment operates at **50% capacity**. Speed unchanged.

## Damage

Bombardment hits **specific segments** (1-3 hexes). A blown bridge, a damaged stretch.

- Damaged segment loses capacity (percentage)
- If destroyed at 100%, flow stops at that point — resources must find an alternative path (if a branch exists) or flow halts
- Resources in transit in the destroyed segment are **lost**
- Repair costs CP proportional to damage and segment level

## Visual Feedback

- **Physical particles**: each resource produced at a factory becomes a visible particle (resource color) that travels hex-by-hex along the supply line
- **Particle lifecycle**: born at factory → travels through network → slows at bottlenecks → queues if saturated → arrives at depot (only then depot stock increments)
- **Saturation readable from flow**: sparse particles = under-utilized. Dense, slow-moving particles = saturated/bottleneck. No artificial color on the line
- **Neutral line visual**: the line itself reflects only its level (thickness, style), not load
- **Destruction**: destroyed segment → particles in that stretch disappear, upstream particles stop and accumulate
- **Bidirectional**: if the line carries in both directions, particles visible moving both ways

## Health States (visual)

Supply line visual is neutral — no color coding for load. Damage only:

| State | Visual |
|-------|--------|
| Intact | Normal level-based visual |
| Damaged | Red flash overlay on affected hexes |
| Destroyed | Dashed grey line with red X at break point |
