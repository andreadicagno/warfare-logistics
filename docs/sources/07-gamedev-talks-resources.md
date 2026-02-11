# Game Development Talks and Resources: Wargame Design and Logistics

A comprehensive compilation of GDC talks, developer interviews, podcasts, and educational resources covering wargame design, resource management, logistics systems, and the complexity vs. accessibility debate in strategy games.

---

## Table of Contents

1. [GDC Talks](#gdc-talks)
2. [Notable Game Designers and Their Work](#notable-game-designers-and-their-work)
3. [Podcasts for Strategy Game Design](#podcasts-for-strategy-game-design)
4. [Developer Diaries and Postmortems](#developer-diaries-and-postmortems)
5. [Books and Written Resources](#books-and-written-resources)
6. [YouTube Channels and Video Resources](#youtube-channels-and-video-resources)
7. [Key Design Principles Summary](#key-design-principles-summary)

---

## GDC Talks

### Strategy Game Design and the Operational Level of War

**Source:** [GDC Vault](https://gdcvault.com/play/1023822/Strategy-Game-Design-and-the)

**Key Insights:**
- Military theory classically divides war into strategic, operational, and tactical levels
- Each level requires different game mechanics and player agency
- Operational level is often the most underserved in game design
- Understanding these distinctions helps designers create more coherent strategy experiences

---

### Designing Grand Strategy: Making the Mechanics of Total War

**Source:** [GDC Vault](https://gdcvault.com/play/1017755/Designing-Grand-Strategy-Making-the)

**Key Insights:**
- Explores design problems including realism vs. simulation vs. game rules
- Addresses mystery vs. clarity in game information
- Discusses decisions and counterpoint in strategy design
- Examines gameplay depth vs. micromanagement tradeoffs
- Covers gameplay system dynamics in grand strategy

**Design Principles:**
- Balance historical accuracy with player enjoyment
- Create meaningful choices at every level
- Manage complexity through careful UI/UX design

---

### Building Sustainable Game Economies: The Three Design Pillars

**Source:** [GDC Vault](https://gdcvault.com/play/1028982/Building-Sustainable-Game-Economies-The)

**Presenter:** Edward Castronova (via Machinations.io)

**Key Insights:**
- Demystifies economic concepts like inflation for game designers
- Reviews approaches to in-game currencies and resource allocation
- Covers trading and pricing systems design
- Emphasizes data-driven decision making
- Highlights continuous testing and iteration

**Three Design Pillars:**
1. Clear resource sources and sinks
2. Balanced production and consumption rates
3. Player agency in economic decisions

---

### Macroeconomics of a Game Economy

**Source:** [GDC Vault](https://gdcvault.com/play/1026465/Macroeconomics-of-a-Game)

**Key Insights:**
- Applies macroeconomic principles to game design
- Helps create balanced game economy systems
- Covers inflation, deflation, and resource scarcity
- Discusses long-term economic health in persistent games

---

### Balancing Your Game Economy: Lessons Learned

**Source:** [GDC Vault](https://gdcvault.com/play/1015151/Balancing-Your-Game-Economy-Lessons)

**Key Insights:**
- Best practices for balancing currency and pricing
- Target market considerations in economy design
- Examples from social games

---

### Guerilla Prototyping: Design Post-mortem of HOARD

**Source:** [GDC Vault](https://gdcvault.com/play/1015313/Guerilla-Prototyping-A-Design-Post)

**Key Insights:**
- Maximize iterations with limited resources
- Use paper games and low-fi 2D prototyping
- MS Excel as a level design tool
- Modular systems design approach for strategy games

---

### Strategy Games: The Next Move (Free Panel)

**Source:** [GDC Vault Free Section](https://gdcvault.com/free)

**Panelists:** Tom Chick, Soren Johnson, Jon Shafer, Ian Fischer, Dustin Browder

**Topics Covered:**
- Rising trends in strategy games
- Overlooked innovations in the genre
- Free-to-play implications
- Online persistence mechanics
- Future trajectory of strategy gaming

---

### How Tabletop Design Helped Shape UFO 50

**Source:** [GDC Vault](https://gdcvault.com/play/1035154/How-Tabletop-Design-Helped-Shape)

**Presenter:** Jon Perry

**Key Insights:**
- Leveraging board game design for video games
- Design tools from tabletop applicable to digital
- Cross-pollination between analog and digital strategy design

---

## Notable Game Designers and Their Work

### Sid Meier - Civilization Series

**Key Philosophy:** "A game is a series of interesting choices"

**GDC Presentations:**
- [GDC 2010 Keynote](https://gdconf.com/news/sid_meier_keynote_major_new_le)
- [GDC 2012: Interesting Decisions](https://www.gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions)

**Design Principles:**
1. **Psychology over mathematics** - Player perception matters more than mathematical accuracy
2. **Turn-based for agency** - Players feel like the star, not observers
3. **Avoid repetition** - What's interesting once isn't necessarily interesting ten times
4. **Multiple viable strategies** - No dominant strategy in well-balanced games
5. **Player as the winner** - The AI should make players feel smart

**Resource:** [Designer Notes - Sid's Rules](http://www.designer-notes.com/game-developer-column-5-sids-rules/)

---

### Soren Johnson - Civilization IV, Offworld Trading Company, Old World

**Key Philosophy:** Economic systems as core gameplay drivers

**Background:**
- Lead designer on Civilization IV
- Founded Mohawk Games
- Created Offworld Trading Company (economic RTS)

**Design Principles:**
1. **Economy as gameplay** - Resource flow can be the primary mechanic
2. **Player-driven markets** - Dynamic pricing creates emergent gameplay
3. **Influence from Railroad Tycoon** - Shipping routes and resource trees
4. **Remove combat for focus** - Offworld proves strategy works without traditional warfare

**Resources:**
- [Designer Notes Blog](http://www.designer-notes.com/)
- [Designer Notes Podcast](https://podcasts.apple.com/us/podcast/designer-notes/id935345158)
- [Game Design Round Table #94: Offworld Trading Company](https://thegamedesignroundtable.com/2014/08/26/episode-94-offworld-trading-company/)

---

### Jake Solomon - XCOM: Enemy Unknown, XCOM 2

**Key Philosophy:** Consequences make success meaningful

**Design Principles:**
1. **Meaningful consequences** - Loss of soldiers/missions creates tension
2. **Permadeath requires turn-based** - Players need time to make careful decisions
3. **The XCOM loop** - Tense combat earns resources for upgrades returning to combat
4. **Prototype ruthlessly** - Board game prototypes with Risk pieces
5. **Simplify complexity** - Early prototypes were too complex for broad appeal

**Four Essential XCOM Ingredients:**
1. Tactical turn-based combat
2. Strategic layer management
3. Permadeath consequences
4. Character customization/attachment

**Resources:**
- [Classic Postmortem: XCOM: Enemy Unknown](https://www.gamedeveloper.com/design/classic-postmortem-i-xcom-enemy-unknown-i-which-turns-5-today)
- [Randomness in XCOM 2](https://www.gamedeveloper.com/design/jake-solomon-explains-the-careful-use-of-randomness-in-i-xcom-2-i-)

---

### Jon Shafer - Civilization V, At the Gates

**Key Philosophy:** Learning through failure and iteration

**Background:**
- Lead designer on Civilization V at age 25
- Seven-year development of At the Gates
- Later joined Paradox Interactive

**Design Focus:**
- 4X mechanics in historical settings
- Hex-based movement systems
- Resource depletion and migration mechanics

**Resources:**
- [Jon Shafer on Design Blog](https://jonshaferondesign.com/)
- [At the Gates Development Story](https://www.pcgamer.com/how-making-a-new-strategy-game-nearly-destroyed-civ-5-designer-jon-shafers-life/)

---

### Volko Ruhnke - COIN Series, Levy & Campaign Series

**Key Philosophy:** History drives mechanics, not vice versa

**Design Principles:**
1. **Start with historical dynamics** - Identify underrepresented conflicts
2. **Asymmetric design** - Different factions play by different rules
3. **Explicit logistics** - Levy & Campaign series emphasizes supply mechanics
4. **Card-driven events** - Cards drive initiative rather than hand management

**Supply Mechanics in Levy & Campaign (Nevsky):**
- Explicit logistical play
- Supply and movement of provisions
- Route-based logistics across seasons
- Weather impacts on supply lines

**Resources:**
- [Interview Part I: COIN Series Design](https://theplayersaid.com/2016/08/22/interview-with-coin-series-creator-designer-volko-ruhnke-part-i/)
- [Shut Up & Sit Down Interview](https://www.shutupandsitdown.com/interview-volko-ruhnke/)
- [Nevsky Design Interview](https://theplayersaid.com/2018/07/09/interview-with-volko-ruhnke-designer-of-nevsky-teutons-and-rus-in-collision-1240-1242-from-gmt-games/)

---

### Gary Grigsby - War in the East, War in the West

**Key Philosophy:** Deep simulation of historical operations

**Design Principles:**
1. **Turn-based for strategic depth** - Mirrors historical command pacing
2. **Meaningful time increments** - Turns represent days or weeks
3. **Integrated fog of war** - Uncertainty as core mechanic
4. **Supply line systems** - Central to gameplay
5. **Morale systems** - Human factors in warfare

**Resources:**
- [Interview: War in the West](http://www.matrixgames.com/forums/viewtopic.php?t=273099)
- [Slitherine: 40 Years of Wargaming](https://www6.slitherine.com/news/40-years-of-wargaming-gary-grigsbys-anniversary)

---

## Podcasts for Strategy Game Design

### Three Moves Ahead

**Platform:** [Apple Podcasts](https://podcasts.apple.com/us/podcast/three-moves-ahead/id307176617) | [Idle Thumbs](https://www.idlethumbs.net/3ma/)

**Focus:** Strategy and war games, design issues, industry discussion

**Why Listen:**
- Weekly panel discussions with knowledgeable gamers
- Coverage of new releases and design trends
- Deep dives into specific games and mechanics
- City builders, grand strategy, roguelikes, RTS coverage

---

### Designer Notes

**Host:** Soren Johnson

**Platform:** [Apple Podcasts](https://podcasts.apple.com/us/podcast/designer-notes/id935345158) | [Website](http://www.designer-notes.com/)

**Notable Episodes:**
- Sid Meier (Parts 1 & 2) - Pirates!, Railroad Tycoon, Civilization
- Brian Reynolds - Colonization, Civ 2, Alpha Centauri, Rise of Nations
- Anton Strenger - Civilization 5, 6, and Beyond Earth

**Why Listen:**
- In-depth career retrospectives with legendary designers
- Technical and personal questions balanced
- Peer-to-peer conversations with honest critique

---

### The Game Design Round Table

**Focus:** Game design theory and practice

**Notable Episode:** [#94: Offworld Trading Company](https://thegamedesignroundtable.com/2014/08/26/episode-94-offworld-trading-company/) with Soren Johnson and Jon Shafer

---

### eXplorminate

**Platform:** [Apple Podcasts](https://podcasts.apple.com/us/podcast/explorminate/id979413290) | [Spotify](https://open.spotify.com/show/7e71RtAPtXGvD0XXCaglSS)

**Focus:** 4X, strategy, and tactics games

**Notable Interviews:**
- Lennart Sas (Age of Wonders 4 Game Director)
- Victor Reijkersz (Shadow Empire developer)
- Illwinter Game Design (Dominions, Conquest of Elysium)
- Johnny Lumpkin (Terra Invicta Creative Director)

---

### Wargames, Soldiers and Strategy

**Platform:** [Apple Podcasts](https://podcasts.apple.com/us/podcast/wargames-soldiers-and-strategy/id1123577173) | [Libsyn](https://wsspodcast.libsyn.com/)

**Focus:** Historical wargaming, tabletop design, designer interviews

**Why Listen:**
- Balance between realism, fun, and playability
- Designer interviews on bringing history to tabletop
- Both miniatures and hex-and-counter coverage

---

### The Art of Wargaming

**Platform:** [Apple Podcasts](https://podcasts.apple.com/us/podcast/the-art-of-wargaming/id1483003593)

**Focus:** Professional and hobby wargaming

---

## Developer Diaries and Postmortems

### Hearts of Iron IV - Supply System Rework

**Source:** [Paradox Forums](https://forum.paradoxplaza.com/forum/threads/hoi4-dev-diary-early-look-at-at-supply-and-the-coming-year.1466076/) | [Steam News](https://store.steampowered.com/news/app/394360/view/3097888757398140879)

**Key Design Goals:**
1. Make logistics more player-interactive
2. Create strategic importance for railways
3. Enable fighting over supply infrastructure
4. Force careful planning for offensives
5. Make terrain and weather matter for supply

**System Overview:**
- Supply flows from capital through railways
- Railway level acts as bottleneck
- Truck-based component for off-rail supply
- Supply hubs as distribution points
- Multiple supply sources per division

**Design Lessons:**
- Logistics should be engaging, not just penalty management
- Infrastructure becomes strategic objective
- Weather and terrain create natural chokepoints

---

### Stellaris - Postmortem

**Source:** [Gamasutra Postmortem](https://www.gamedeveloper.com/design/postmortem-paradox-development-studio-s-i-stellaris-i-)

**Design Philosophy:**
- "One third Star Control 2, one third Master of Orion 2, one third Europa Universalis IV"
- Marry scripted storytelling with 4X and grand strategy
- Focus on exploration and expansion

**Economy System:**
- Five main resources: energy credits, minerals, food, consumer goods, alloys
- Each resource has primary economic purpose
- Custodians initiative for ongoing balance updates

---

### Total War Series - Design Philosophy

**Source:** [GDC Vault - Designing Grand Strategy](https://gdcvault.com/play/1017755/Designing-Grand-Strategy-Making-the) | [Developer Interviews](https://www.inverse.com/gaming/total-war-25th-anniversary-developer-interview)

**Key Challenges:**
- Balancing legacy features with new historical settings
- Managing veteran expectations vs. new player accessibility
- Adding complexity without overwhelming

**Design Principles:**
- Morale, fatigue, formations as core tactical mechanics
- Terrain advantage creates tactical depth
- Campaign layer provides strategic context
- Each title builds "potential features" list for selection

---

### Relic Entertainment RTS Games (Company of Heroes, Dawn of War)

**Source:** [Gamasutra Analysis](https://www.gamedeveloper.com/design/inspired-designs-in-relic-s-rts-games)

**Infantry Design Innovations:**
- Units feel versatile and capable
- Vaulting over obstacles
- Terrain-based armor bonuses (craters provide cover)
- Infantry has relationship with map environment
- Cover system creates tactical positioning

---

### Factorio - Design Philosophy

**Key Design Principles:**
1. **Modding as core feature** - Game designed for modder accessibility
2. **Complexity through emergence** - Simple rules create complex behavior
3. **Optimization as gameplay** - Efficiency drives engagement
4. **No combat focus necessary** - Logistics can be the entire game

---

## Books and Written Resources

### Simulating War: Studying Conflict through Simulation Games

**Author:** Philip Sabin (Professor of Strategic Studies, King's College London)

**Source:** [Amazon](https://www.amazon.com/Simulating-War-Studying-Conflict-Simulation/dp/1472533917)

**Key Topics:**
- Movement, combat, and logistics modeling techniques
- Quantification and random variation
- Turn-based time division
- Modeling generalship and command delays
- Intelligence, fog of war, sequence of play
- Hidden units and artificial intelligence
- Balancing luck, skill, and historicity
- Victory incentives and playtesting

**Includes:** Eight simple illustrative simulations with rules, maps, and counters

---

### Wargame Design: History, Production, and Use of Conflict Simulation Games

**Authors:** Staff of Strategy & Tactics Magazine (1977)

**Source:** [Goodreads](https://www.goodreads.com/book/show/189543.Wargame_Design)

**Focus:** Principles of conflict simulation design, guidance for original game creation

---

### The Wargames Handbook (Third Edition)

**Author:** James F. Dunnigan

**Classic resource for understanding wargame mechanics and design philosophy**

---

### The Art of Wargaming: A Guide for Professionals and Hobbyists

**Author:** Peter Perla

**Focus:** Professional wargaming applications and hobby design principles

---

### Designing Wargames: Introduction

**Author:** George Phillies

**Source:** [Everand](https://www.everand.com/book/220336866/Designing-Wargames-Introduction)

**Focus:** Classic hex-and-counter board wargame design, written as textbook

---

## YouTube Channels and Video Resources

### Game Maker's Toolkit (GMTK)

**Creator:** Mark Brown

**Platform:** [YouTube](https://www.youtube.com/channel/UCqJ-Xo29CKyLTjn6z2XwYAw) | [Website](https://gamemakerstoolkit.com/)

**Relevant Content:**
- How Video Game Economies are Designed
- How Sims Make Decisions
- Teaching Complex Games
- Boss Keys series (non-linear design)

**Format:** Analytical video essays on game design principles

---

### How Wargames Model Logistics

**Source:** [Meeple Mountain](https://www.meeplemountain.com/articles/how-wargames-model-logistics/)

**Key Concepts:**
- Line of Supply (LOS) mechanics
- Tracing supply from unit to source
- Overland LOS typically 6 hexes to road/rail
- Enemy zones of control block supply
- Consequences: reduced combat strength or elimination
- Logistics chit system (randomized supply checks)

---

### Complexity vs. Depth Analysis

**Source:** [Game Wisdom](https://game-wisdom.com/critical/accessibility-vs-depth)

**Key Framework:**
- Comprehension Complexity - How hard to understand
- Tracking Complexity - How much to remember
- Depth - Meaningful decision variety

**Design Approach:**
- Build the best complex version first
- Then work on accessibility
- Perceived complexity vs. systemic complexity

---

### RTS and Strategy Game Tutorials

**Sources:**
- [GameDev Academy - Strategy Game Tutorials](https://gamedevacademy.org/best-strategy-game-tutorials/)
- [Game Design Skills - RTS Fundamentals](https://gamedesignskills.com/game-design/real-time-strategy/)

**Core Concepts Covered:**
- Resource management systems (source, stockpile, carrier)
- Turn-based vs. real-time decisions
- Grid-based placement and movement
- Economy building and warfare balance

---

## Key Design Principles Summary

### Wargame Design Principles

1. **Levels of War Matter**
   - Strategic: Long-term planning, resource allocation
   - Operational: Campaign movement, logistics
   - Tactical: Individual engagements

2. **Supply Line Mechanics**
   - Line of Supply (LOS) tracing
   - Distance limits (typically 6 hexes overland)
   - Road/rail connectivity requirements
   - Enemy interdiction possibilities
   - Consequences for supply failure

3. **Fog of War Implementation**
   - Hidden units
   - Partial information
   - Intelligence mechanics
   - Command delays

---

### Resource Management Principles

1. **Three-Part Systems**
   - Sources (generation)
   - Sinks (consumption)
   - Carriers (transport)

2. **Economic Balance**
   - Production vs. consumption rates
   - Inflation prevention
   - Multiple resource types
   - Player agency in allocation

3. **Meaningful Choices**
   - No dominant strategies
   - Trade-offs in every decision
   - Long-term vs. short-term planning

---

### Complexity vs. Accessibility

1. **Types of Complexity**
   - Comprehension (rules understanding)
   - Tracking (information management)
   - Depth (decision space)

2. **Onboarding Strategies**
   - Gradual mechanic introduction
   - Build-up scenarios
   - Clear tutorials
   - Tooltips and contextual help

3. **Design Philosophy Options**
   - Build complex, then simplify presentation
   - Design for accessibility, add optional depth
   - Modular complexity (optional advanced rules)

---

### Logistics System Design

1. **Hearts of Iron IV Approach**
   - Railway-based supply flow
   - Bottleneck mechanics
   - Truck-based extension
   - Strategic infrastructure targets
   - Weather and terrain effects

2. **Traditional Wargame Approach**
   - Hex-based LOS tracing
   - Supply source requirements
   - Zone of control blocking
   - Attrition for cut-off units

3. **Factory Game Approach (Factorio)**
   - Throughput optimization
   - Bottleneck identification
   - Automation as solution
   - Emergent complexity

---

## Quick Reference Links

### GDC Vault (Strategy/Wargame)
- [Strategy Game Design and Operational Level of War](https://gdcvault.com/play/1023822/Strategy-Game-Design-and-the)
- [Designing Grand Strategy: Total War](https://gdcvault.com/play/1017755/Designing-Grand-Strategy-Making-the)
- [Building Sustainable Game Economies](https://gdcvault.com/play/1028982/Building-Sustainable-Game-Economies-The)
- [GDC Vault Free Section](https://gdcvault.com/free)

### Podcasts
- [Three Moves Ahead](https://www.idlethumbs.net/3ma/)
- [Designer Notes](http://www.designer-notes.com/)
- [eXplorminate](https://explorminate.org/)

### Developer Blogs
- [Jon Shafer on Design](https://jonshaferondesign.com/)
- [Designer Notes Blog](http://www.designer-notes.com/)
- [Paradox Developer Diaries](https://hoi4.paradoxwikis.com/Developer_diaries)

### Analysis Sites
- [Meeple Mountain - Wargames](https://www.meeplemountain.com/articles/how-wargames-model-logistics/)
- [The Players' Aid](https://theplayersaid.com/)
- [Game Wisdom](https://game-wisdom.com/)

---

*Document compiled from web research conducted February 2026. Links verified at time of compilation.*
