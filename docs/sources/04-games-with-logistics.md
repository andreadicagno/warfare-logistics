# Games with Realistic Logistics Systems

This document surveys wargames and strategy games that emphasize logistics and supply mechanics, examining how they implement these systems, what makes them engaging or frustrating, and key design lessons for game developers.

---

## 1. Decisive Campaigns Series

**Developer:** VR Designs / Matrix Games
**Type:** Turn-based operational wargame
**Setting:** World War II

### How Logistics Works

The Decisive Campaigns series, particularly **Decisive Campaigns: Barbarossa**, features one of the most detailed supply systems in operational wargaming.

**Supply Pipeline System:**
- Supply originates from Berlin and flows through a pipeline of bases: Main Depot -> Forward Supply Base (FSB) -> Panzergruppe HQ -> Units
- Main Depots are fixed locations while FSBs can be relocated to cities via player decisions
- Transport capacity determines throughput, with distance and friction (wear on trains/trucks) reducing delivery rates

**Fuel Quota System:**
- A "Quota" represents enough fuel for a Panzergruppe to operate at full tempo (100 AP) for one turn
- Quotas are dynamically calculated at the start of each turn based on unit composition
- Mechanized infantry burns significantly less fuel than panzer units

**Action Point Range:**
- Units can only receive supply from within 250 AP range
- This creates natural operational limits that mirror historical constraints

**Forward Supply Base Mechanics:**
- Relocating an FSB shuts down the pipeline for several turns (no fuel arrives)
- Transport links automatically extend as FSBs and HQs move forward
- Players must balance advance speed against supply line extension

### What Makes It Interesting

- **Historical Authenticity:** The Germans historically faced severe fuel shortages that immobilized Panzergruppen for weeks. The game makes this a central strategic concern rather than an afterthought.
- **Meaningful Decisions:** Players must carefully plan offensives, building fuel reserves before launching multi-turn operations.
- **Traffic Congestion (Ardennes Offensive):** The newest entry adds traffic rules that impact fuel deliveries, especially relevant for the narrow roads of the Ardennes.

### Frustrations

- Learning curve is steep; understanding the supply system requires tutorial videos and experimentation
- Managing supply can feel like a separate game running alongside combat operations
- Supply problems can halt exciting offensive operations unexpectedly

### Key Design Lessons

1. **Supply should create strategic tempo:** The need to pause and accumulate reserves before offensives creates natural operational rhythms
2. **Infrastructure matters:** The pipeline metaphor makes infrastructure decisions tangible
3. **Differentiate unit consumption:** Different unit types consuming resources at different rates adds tactical depth

---

## 2. Gary Grigsby's War in the East / War in the West

**Developer:** 2by3 Games / Matrix Games
**Type:** Grand operational turn-based wargame
**Setting:** World War II Eastern and Western Fronts

### How Logistics Works

These games feature perhaps the most comprehensive logistics simulation in commercial wargaming, with systems complex enough to fill dedicated manual chapters.

**Freight and Rail Network:**
- "Freight" is the universal measure for all transported material
- Rail and cargo ships transport freight to depots for conversion into supplies, fuel, ammo, and replacements
- Depots must connect to the supply grid via undamaged rail lines to function

**Dual-Track Rail System:**
- Railways are divided into dual and single-track lines
- Track type impacts movement costs and supply throughput
- Rail usage is tracked per hex with congestion restricting troop and supply movements

**Rail Repair (Western Allies):**
- Allied players must manually repair rail lines using rail engineer groups
- This creates a distinct gameplay loop of pushing forward then pausing to rebuild infrastructure

**Depot Network (Germans):**
- German logistics focus on supply prioritization and efficient depot placement
- Players set depot priorities (like dams) to control freight flow and minimize truck expenditure

**Combat Preparation Points:**
- Units accumulate Combat Preparation Points during rest periods
- This simulates supply buildup before major offensives
- Punishes units that attack every turn without recovery time

### What Makes It Interesting

- **Armies outrun supply lines:** The fundamental historical problem of the Eastern Front is accurately modeled
- **Infrastructure as gameplay:** Managing rail networks becomes a strategic minigame
- **Realistic constraints:** The system forces historical pacing without arbitrary rules

### Frustrations

- Extreme complexity with rulebooks spanning 50+ pages on logistics alone
- Supply problems can feel opaque; diagnosing why units lack supply requires deep system knowledge
- The detail level can overwhelm players who want to focus on combat operations
- Rail repair mechanics (for Allies) can feel tedious

### Key Design Lessons

1. **Show the bottlenecks:** Visual indicators of rail capacity and depot status help players understand the system
2. **Infrastructure has memory:** Damaged rail takes time to repair, creating lasting consequences for combat
3. **Different factions, different challenges:** Germans manage scarcity while Allies manage expansion
4. **Preparation as a resource:** Combat Preparation Points elegantly model the buildup-to-attack cycle

---

## 3. Foxhole (Multiplayer Logistics)

**Developer:** Siege Camp
**Type:** Persistent multiplayer war game
**Setting:** Alternate-history World War

### How Logistics Works

Foxhole is unique in that logistics are performed entirely by human players in real-time, creating a true player-driven economy of war.

**Player-Produced Everything:**
- Every rifle, shell, tank, and drop of fuel is gathered, refined, manufactured, and transported by players
- Nothing spawns automatically; all resources flow from player effort

**Production Chain:**
- Logistics players mine raw resources
- Resources are refined at refineries
- Refined materials are crafted into goods at factories
- Finished goods are transported via trucks, trains, and ships to frontline bases

**Spawn System ("Shirts"):**
- Soldier Supplies ("Shirts") are consumed each time a player spawns at a base
- This creates direct link between logistics effort and combat sustainability
- Running out of shirts means no reinforcements

**Infrastructure Building:**
- Players construct railway systems for long-distance supply
- Industrial bases can be developed into mass production centers
- Shipping ports service hundreds of logistics players

**Supply Line Warfare:**
- Enemies can win by cutting supply lines or sabotaging infrastructure
- Partisan operations behind enemy lines have real impact

### What Makes It Interesting

- **Social emergent gameplay:** Logistics creates organic teamwork and community
- **Real stakes:** Hours of logistics work directly enable frontline victories
- **Strategic depth:** Cutting enemy supply is as valid as direct combat
- **Visible impact:** Players see the goods they produced being used in battle

### Frustrations

The logistics player experience has been contentious enough to generate player strikes:

- **Time investment:** Solo logistics requires many hours to match regiment efficiency
- **Burnout:** Repetitive tasks (mining, hauling, refining) wear on players
- **Pull times:** Acquiring resources from public stockpiles takes too long
- **Late-game vehicles:** Producing tanks requires extensive facility preparation
- **Under-appreciation:** Logistics players often feel their effort goes unrecognized
- **Macro requirements:** Some tasks are tedious enough that players resort to auto-clickers

### Key Design Lessons

1. **Human logistics creates community:** Player interdependence builds social bonds
2. **Visibility matters:** Players need to see their contribution's impact
3. **Respect player time:** Repetitive tasks without agency cause burnout
4. **Balance solo vs. group play:** Systems shouldn't require clan membership to be viable
5. **Recognition systems:** Logistics players need acknowledgment for their efforts

---

## 4. Hearts of Iron IV (Supply System)

**Developer:** Paradox Interactive
**Type:** Grand strategy
**Setting:** World War II

### How Logistics Works

Hearts of Iron IV received a major logistics overhaul in the 1.11 "Barbarossa" patch (No Step Back DLC), replacing the old infrastructure-based system.

**Supply Hub Network:**
- Supplies flow from the capital to supply hubs distributed across territory
- Hubs distribute supplies to nearby troops within their range
- The Capital Hub's capacity scales with national factory count

**Railway System:**
- Railways connect hubs to the capital and each other
- Rail levels (1-5) determine throughput capacity
- Entire routes function at the level of their weakest segment
- Trains must be produced to utilize rail capacity

**Three Supply Sources:**
- **Hub Supply:** Primary distribution from nearby supply hubs
- **Aerial Supply:** Emergency resupply via transport planes
- **State Supply:** Baseline local supply from state infrastructure

**Motorization Levels:**
- Hubs can be motorized to extend supply range
- Requires trucks (40 or 80 depending on level)
- Motorized hubs reach units farther from rail lines

**Logistics Support Companies:**
- Attachable battalions that reduce division supply footprint
- Trade-off between combat capability and supply efficiency

### What Makes It Interesting

- **Visual supply maps:** Clear overlay shows supply coverage and bottlenecks
- **Strategic rail importance:** Capturing or destroying rail infrastructure matters
- **Meaningful decisions:** Motorization, hub placement, and logistics companies offer optimization choices

### Frustrations

The 1.11 overhaul generated significant player frustration:

- **Increased complexity:** More mechanics (hubs, motorization, rail levels) to manage
- **Unclear feedback:** Diagnosing supply problems isn't always intuitive
- **Extra clicks:** More manual intervention required for similar results
- **Large territory expansion:** Conquering the USSR creates tedious supply management
- **Rail cooldowns:** Captured rails have 10-day cooldowns before use (5 days on core territory)
- **Some players seek mods to disable the system entirely**

### Key Design Lessons

1. **Complexity must justify itself:** Added mechanics should create new interesting decisions, not just busywork
2. **Clear visualization is essential:** Players need to understand why supply is failing
3. **Consider edge cases:** Systems should scale gracefully for different game states (small nations vs. massive conquests)
4. **Automation options:** Players should be able to delegate micro-management when desired

---

## 5. Command Ops Series

**Developer:** Panther Games
**Type:** Real-time pausable operational wargame
**Setting:** World War II

### How Logistics Works

Command Ops takes a unique approach by automating most logistics while giving players high-level control.

**Automated Staff Functions:**
- The AI handles convoy routing, route safety assessment, and delivery scheduling
- Supply convoys automatically attempt to resupply units
- Players focus on operational decisions while "staff" handles logistics details

**Supply Classes:**
- Tracks three broad supply categories: basics, ammunition, and fuel
- Each category creates different burdens on the supply system

**Regimental Bases:**
- Lower echelon supply is aggregated at regimental "bases" and above
- Division-level "supply redistribution points" break bulk deliveries into combat loads

**Player Control Points:**
- Players set supply priority levels for units
- Can control consumption rates through movement orders and rate-of-fire settings
- Cannot directly control convoy routing decisions

### What Makes It Interesting

- **Focus on command:** Players make operational decisions while AI handles implementation
- **Realistic constraints:** Supply limits naturally constrain aggressive operations
- **Convoy vulnerability:** Supply convoys can be intercepted, creating emergent tactical situations

### Frustrations

- **AI routing problems:** AI may send convoys through dangerous areas, getting them destroyed
- **Deep penetration penalty:** Players avoid sending units into enemy territory because AI insists on resupplying them (often fatally)
- **Limited control:** Cannot easily tell the AI "don't resupply this unit"
- **Black box feeling:** Hard to understand why supply decisions are made

### Key Design Lessons

1. **Automation needs override options:** Players must be able to intervene when AI makes poor decisions
2. **Transparency in automation:** Players should understand what the AI is doing and why
3. **Risk assessment:** Automated systems should recognize when resupply is too dangerous
4. **Partial automation:** Consider letting players control routing while AI handles execution

---

## 6. Other Notable Games with Realistic Logistics

### Unity of Command 2

**Type:** Turn-based operational wargame

**How It Works:**
- Supply flows from harbors and rail yards via railroads
- Supply depots and trucks (limited quantity) distribute supplies on the battle map
- Players can build, move, and assign supplies to depots

**Progressive Supply Deprivation:**
- Turn 1 out of supply: No suppression recovery
- Turn 2: Two steps suppressed, lose action points
- Turn 3+: Fully suppressed, limited movement, no territory capture, loses steps and specialists

**Design Lesson:** Simple progressive consequences communicate supply importance without complex tracking. Surrounding enemies to cut supply is often more effective than direct assault.

---

### Shadow Empire

**Type:** 4X/Wargame hybrid

**How It Works:**
- Transportation networks connect cities via dirt roads, sealed roads, and railroads
- Truck stations and train stations move supplies through the network
- "Pull" based system where units request needs and supply is allocated

**Strategic Importance:**
- Cutting supply lines starves enemies of food, fuel, and ammunition
- Large empires are vulnerable to having communications severed
- Acts as natural "rubber band" mechanism limiting overextension

**Design Lesson:** Logistics as a unifying mechanic can bridge 4X empire management and wargame combat systems. Described by reviewers as "perhaps better than many bigger wargames."

---

### Grand Tactician: The Civil War

**Type:** Real-time operational strategy

**How It Works:**
- Supply depots send supplies, ammunition, and provisions to nearby armies
- Economic production converts to resources sent to depots
- Depots must be within army command range

**Railroad Importance:**
- Railroads provide 10x transport capacity compared to roads
- Destroying enemy rail networks hampers mobility and concentration
- Cutting supply routes equals attacking depots themselves

**Design Lesson:** The 10x multiplier for rail makes infrastructure investment decisions meaningful and rail destruction strategically valuable.

---

### HighFleet

**Type:** Strategy/roguelike hybrid

**How It Works:**
- Fuel consumed proportionally to ship weight per distance traveled
- Fleet speed limited to slowest ship
- Fuel percentage meter shows capacity; range scale shows maximum flight distance

**Economic Pressure:**
- Fuel cheaper at designated fuel depots (~0.8) vs. regular cities (~1.3)
- Resource management creates constant strategic pressure
- Ship design must balance capability vs. fuel efficiency

**Design Lesson:** Resource management in a roguelike context creates meaningful risk/reward decisions. Ship design becomes an economic puzzle, not just a combat one.

---

### OCS (Operational Combat Series) - Board Wargame

**Type:** Hex-and-counter operational board wargame

**How It Works:**
- Two supply types: Trace supply (general) and Supply points (specific resources)
- Each unit individually resupplied when moving/firing
- Supply phase at end of turn gives surrounded units a chance to break out

**Design Lesson:** Moving supply phase to turn's end creates dramatic tension around encirclements. Detailed individual tracking creates realism but increases play time.

---

### Steel Division 2

**Type:** Real-time tactical/operational wargame

**How It Works:**
- Supply trucks automatically rearm/repair units within ~500m radius
- Artillery requires frequent resupply; rocket artillery needs it after every barrage
- In campaign mode, Action Points represent battalion fatigue; recovery requires being in supply zone

**Simplification from Wargame Series:**
- Removed: infantry squad healing, vehicle repair, fuel limits, FOB resupply
- Focus shifted to ammunition management

**Design Lesson:** Deciding what NOT to simulate is as important as what to include. Steel Division focuses supply on ammo to keep tactical battles flowing.

---

## Design Principles Summary

### Effective Logistics Mechanics Should:

1. **Create meaningful strategic decisions** - Not just busywork, but real trade-offs
2. **Provide clear feedback** - Players must understand why supply is failing
3. **Scale with game scope** - Tactical games need simple systems; operational games can support more detail
4. **Respect player time** - Automation options for repetitive tasks
5. **Match historical constraints** - Systems should naturally produce historical-feeling limitations
6. **Differentiate factions** - Different sides can face different logistics challenges

### Common Pitfalls to Avoid:

1. **Complexity without depth** - More rules don't equal better gameplay
2. **Opaque systems** - Players shouldn't need external guides to understand supply
3. **All-or-nothing supply** - Graduated effects more interesting than binary states
4. **Ignoring automation** - AI assistance needed for tedious tasks
5. **Afterthought implementation** - Logistics should be designed with core gameplay, not bolted on

### The Abstraction Spectrum:

| Approach | Example | Pros | Cons |
|----------|---------|------|------|
| No logistics | Most tactical games | Simple, fast | Unrealistic, no strategic depth |
| Supply lines | Unity of Command | Clear, intuitive | Can feel binary |
| Resource pools | HighFleet | Easy to understand | May feel disconnected from map |
| Infrastructure networks | HOI4, Shadow Empire | Strategic infrastructure | Complex to manage |
| Individual tracking | OCS, Gary Grigsby | Highly realistic | Time-consuming, overwhelming |
| Player-driven | Foxhole | Social, emergent | Burnout risk, time-intensive |

---

## Sources and Further Reading

- [Meeple Mountain: How Wargames Model Logistics](https://www.meeplemountain.com/articles/how-wargames-model-logistics/)
- [BoardGameGeek: Wargames with a focus on logistics](https://boardgamegeek.com/thread/2906171/wargames-with-a-focus-on-logistics)
- [Wargamer: Unity of Command 2 Review](https://www.wargamer.com/unity-of-command-2/review)
- [Explorminate: Shadow Empire Review](https://explorminate.org/shadow-empire-review/)
- [HOI4 Wiki: Logistics](https://hoi4.paradoxwikis.com/Logistics)
- [Foxhole Wiki: Logistics Guide](https://foxhole.wiki.gg/wiki/Community_Guides/Logistics_Quickstart)
- [Kotaku: Foxhole Players Are Striking](https://kotaku.com/foxhole-players-are-striking-over-increased-stress-and-1848370043)
- [Matrix Games Forums: Decisive Campaigns Barbarossa Supply Tutorial](http://www.matrixgames.com/forums/viewtopic.php?t=388413)
- [GameWatcher: Gary Grigsby's War in the East 2 Review](https://www.gamewatcher.com/reviews/Gary%20Grigsby's%20War%20East%202-review/13279)
- [Steam: Command Ops 2 Discussions](https://steamcommunity.com/app/521800/discussions/)
