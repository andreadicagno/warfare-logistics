# Supply Line — Game Bible

A logistics strategy game set in World War 2 where the player manages the supply chain of a military theater. The player does not control combat — only logistics.

## Core Design

- **Time**: Tick-based (1 tick = 1 minute). 1 day = 1440 ticks. Variable speed (1x, 2x, 4x) + pause.
- **Scale**: Abstract small numbers (1-3 digits). All rates expressed per day.
- **Transport**: Automatic network flow. Resources travel as physical particles through supply lines with real transit time.
- **Player role**: Build facilities, lay supply lines, upgrade, repair. No unit or combat control.

## Categories

- **Resources** — Fuel, Ammo, Food, Construction Parts
- **Facilities** — 4 Factory types (Fuel, Ammo, Food, Parts) and Depot, all 5 levels
- **Supply Lines** — 5 levels, built hex-by-hex, branching network
- **Units** — Infantry, Armor, Artillery with NATO symbols and supply status
- **Factions** — Allied (player) and Enemy (AI) territories
- **Mechanics** — Combat, interdiction, front dynamics, victory
- **Terrain** — Terrain types, elevation, moisture, movement costs
- **Map Generation** — Generation pipeline, parameters, seeds
