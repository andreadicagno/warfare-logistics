# Resources

Supply Line uses 4 resource types. The first 3 feed the front line; the 4th is the player's currency for building and expanding the network.

## Resource Types

<!-- component: resource-preview -->

### Fuel

Powers vehicles and mechanized units. Without fuel, armor divisions grind to a halt.

| Property | Value |
|----------|-------|
| Color | `0xccaa22` (gold) |
| Primary Consumer | Armor, Vehicles |
| Source | Fuel Factory |

### Ammo

Ammunition for all combat units. Consumption spikes during active combat.

| Property | Value |
|----------|-------|
| Color | `0x666666` (grey) |
| Primary Consumer | Artillery, Infantry |
| Source | Ammo Factory |

### Food

Sustains all personnel. Every unit consumes food at a steady rate regardless of combat state.

| Property | Value |
|----------|-------|
| Color | `0x44aa44` (green) |
| Primary Consumer | All units (equal) |
| Source | Food Factory |

### Construction Parts

The player's currency. Used to build facilities, lay supply lines, upgrade, and repair damage.

| Property | Value |
|----------|-------|
| Color | `0xcc8833` (orange) |
| Primary Consumer | Player (building/upgrading/repairing) |
| Source | Construction Parts Factory |

Construction Parts do not flow to depots or units. They go directly to construction sites.

## Flow System

Resources flow automatically through the supply network as **physical particles**:
- Produced at a Factory → enter supply line as a particle
- Travel hex-by-hex at the supply line's speed
- Arrive at a Depot → depot stock increments
- Depot distributes to units in range based on distance decay

Status: `[DESIGN COMPLETE]`
