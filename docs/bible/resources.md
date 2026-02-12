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

Resources flow through a **demand-driven** network:

1. Factory produces → resources accumulate in the factory's **internal depot** (output buffer)
2. Depot broadcasts demand → "I need X of this resource"
3. Network resolves → shortest path from source (factory buffer or surplus depot) to demanding depot
4. Shipment dispatched → visible particle travels hex-by-hex at supply line speed
5. Arrival → depot stock increments
6. Distribution → depot delivers to units in range based on distance decay

If no demand exists, the factory's buffer fills up and production pauses. Resources only move when something needs them.

Status: `[DESIGN COMPLETE]`
