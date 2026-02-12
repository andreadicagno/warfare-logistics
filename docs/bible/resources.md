# Resources

Supply Line uses 4 resource types that flow through the logistics network to sustain military operations.

## Resource Types

<!-- component: resource-preview -->

### Fuel

Powers vehicles and mechanized units. Without fuel, armor divisions grind to a halt and supply convoys stop moving.

| Property | Value |
|----------|-------|
| Color | `0xccaa22` (gold) |
| Primary Consumer | Armor, Vehicles |
| Source | Factories, Ports |
| Critical Threshold | 20% |

### Ammo

Ammunition for all combat units. Artillery units consume ammo at the highest rate, especially during offensives.

| Property | Value |
|----------|-------|
| Color | `0x666666` (grey) |
| Primary Consumer | Artillery, Infantry |
| Source | Factories |
| Critical Threshold | 25% |

### Food

Sustains all personnel. Every unit consumes food at a steady rate regardless of combat state, though attacking units use more.

| Property | Value |
|----------|-------|
| Color | `0x44aa44` (green) |
| Primary Consumer | All units (equal) |
| Source | Ports, Rear depots |
| Critical Threshold | 15% |

### Parts

Spare parts and maintenance materials. Required to repair damaged facilities and keep vehicles operational.

| Property | Value |
|----------|-------|
| Color | `0xcc8833` (orange) |
| Primary Consumer | Factories, Vehicles |
| Source | Factories, Ports |
| Critical Threshold | 10% |

## Flow System

Resources flow automatically through the supply network based on:
- **Priority**: Units in combat get priority over reserves
- **Distance**: Closer facilities serve first
- **Capacity**: Route level determines max throughput
- **Demand**: Units request what they need, network tries to deliver

Status: `[DESIGN COMPLETE]` — Flow system not yet implemented
