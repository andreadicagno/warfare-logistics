# Mechanics

Core game systems that drive Supply Line gameplay. The player manages logistics; combat and front movement are simulated automatically.

## Time System

- **Tick-based**: 1 tick = 1 minute of game time
- **1 day** = 1440 ticks
- **Variable speed**: 1x, 2x, 4x + pause
- All player-visible rates expressed **per day**; engine divides by 1440 internally

### Phase Order (per tick)

1. **Production** — Factories generate resource particles
2. **Transport** — Particles travel through supply line network
3. **Distribution** — Depots distribute to units in range
4. **Consumption** — Units consume resources based on their state
5. **Combat** — Front pressure, hex-by-hex movement
6. **Interdiction** — Enemy bombardments (probability per tick)
7. **Construction** — Structures under construction advance by 1 tick

Status: `[DESIGN COMPLETE]`

## Supply Flow

Resources flow from production to consumption as physical particles:

1. **Production** — Factory produces resource particles each tick
2. **Transit** — Particles travel through supply lines at the line's speed (hex/hr)
3. **Storage** — Particles arrive at depot, stock increments
4. **Distribution** — Depot distributes to units in range (distance decay + throughput cap)
5. **Consumption** — Units consume resources based on type and state

Status: `[DESIGN COMPLETE]`

## Combat

The front is an autonomous machine. The player feeds it; it fights on its own.

### Pressure

Every front-line hex has a **force** per side (Allied vs Enemy). Force depends on:
- Type and size of adjacent units
- Supply level (well-supplied units fight better)
- Terrain (defender in hills/forest gets bonus)

### Combat Effectiveness by Supply

| Supply Level | Effectiveness |
|-------------|---------------|
| 80-100% | 100% |
| 60-79% | 75% |
| 40-59% | 50% |
| 20-39% | 25% — defense only, cannot attack |
| 0-19% | 10% — collapse, automatic retreat |

### Front Movement

Each tick the force ratio is calculated on every front-line hex. If one side has double the force, the hex changes hands. The front moves slowly, hex by hex. A broad advance requires superiority across many hexes simultaneously.

### Impassable Terrain

Units cannot occupy or cross Water or Mountain hexes. Mountain chains and rivers form natural defensive lines where the front slows or stops.

### Cascading Consequences

Front advances → units move away from depots → supply drops → effectiveness drops → front slows or retreats. The player must chase the front with new depots and supply lines.

Status: `[DESIGN COMPLETE]`

## Interdiction

The enemy attacks the logistics network. Simple system — random bombardments. **To be expanded in the future.**

### Mechanics

Each tick there is a probability the enemy bombs a target. Probability scales with:
- **Proximity to front** — structures near the front are hit more often
- **Target value** — high-level factories and full depots attract more attention
- **Density** — areas with many structures clustered together have higher probability

### Targets

| Target | Effect | Repair Cost |
|--------|--------|-------------|
| Supply line segment (1-3 hex) | Capacity reduced or destroyed, in-transit resources lost | CP proportional to damage and level |
| Factory | Production reduced (% throughput lost) | CP proportional to damage |
| Depot | Distribution throughput reduced (stock intact) | CP proportional to damage |

### Intensity

Interdiction increases gradually during the game. Rare at the start, frequent toward the end. No warning — the player must build redundancy preventively.

### Repair

Player spends Construction Parts to repair. Repair takes time proportional to damage. Damaged structures continue operating at reduced capacity during repair.

Status: `[DESIGN COMPLETE — TO EXPAND]`

## Victory Conditions

- **Victory**: the enemy loses all territory
- **Defeat**: you lose all territory

Status: `[DESIGN COMPLETE]`

## Player Actions

### Can do

- **Build**: Factory (on Urban or adjacent), Depot (any passable hex), Supply line (hex-by-hex on passable terrain)
- **Upgrade** (lv1→5): Factory (stopped), Depot (stopped), Supply line (50% capacity)
- **Repair**: any damaged structure or segment (costs CP + time)
- **Control time**: pause, 1x, 2x, 4x
- **Observe**: particles, flows, stocks, unit status, front

### Cannot do

- Control units (automatic)
- Control combat (automatic)
- Move resources already in transit
- Build on Water or Mountain
