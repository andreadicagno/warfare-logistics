# Mechanics

Core game systems that drive Supply Line gameplay. The player manages logistics; combat and front movement are simulated automatically.

## Supply Flow

Resources flow from production to consumption through the network:

1. **Production** — Factories produce resources each day
2. **Storage** — Depots buffer resources near the front
3. **Transport** — Trucks/trains carry resources along supply lines
4. **Consumption** — Units consume resources based on state and type

Status: `[CONCEPT]`

## Combat

Units fight automatically based on their supply status:

| Supply Level | Combat Effectiveness |
|-------------|---------------------|
| 80-100% | Full effectiveness |
| 50-79% | Reduced (-25%) |
| 25-49% | Degraded (-50%) |
| 0-24% | Minimal (-75%) |

Status: `[CONCEPT]`

## Interdiction

The enemy can attack your supply lines and facilities:

- **Bombing** — Damages supply lines, reduces capacity
- **Artillery** — Damages nearby facilities
- **Raids** — Cuts supply lines temporarily
- **Sabotage** — Reduces facility throughput

Status: `[CONCEPT]`

## Front Dynamics

The front line moves based on relative combat power:

- **Advance** — Well-supplied side pushes forward
- **Retreat** — Under-supplied side falls back
- **Stalemate** — Balanced forces hold position
- **Collapse** — Critical supply failure triggers rapid retreat

Status: `[CONCEPT]`

## Victory Conditions

- **Territorial** — Control X% of the map
- **Logistical** — Maintain supply to all front-line units for Y days
- **Enemy collapse** — Enemy supply network fails completely

Status: `[CONCEPT]`
