# Supply Line — Game Mechanics Design

**Data**: 2025-02-12
**Stato**: Approvato per sviluppo

---

## 1. Sistema del Tempo

- **Tick-based**: 1 tick = 1 minuto di gioco
- **1 giorno** = 1440 tick
- **Velocità variabile**: 1x, 2x, 4x + pausa
- Tutti i tassi visibili al giocatore espressi **per giorno**; il motore divide per 1440 internamente

### Fasi per tick (ordine di risoluzione)

1. **Produzione** — Factory generano risorse (particelle)
2. **Trasporto** — Particelle viaggiano nella rete supply line
3. **Distribuzione** — Depot distribuiscono alle unità nel raggio
4. **Consumo** — Unità consumano risorse in base al loro stato
5. **Combattimento** — Pressione fronte, movimento hex
6. **Interdizione** — Bombardamenti nemici (probabilità per tick)
7. **Costruzione** — Strutture in costruzione avanzano di 1 tick

---

## 2. Risorse

4 risorse. Le prime 3 alimentano il fronte, la 4a è la valuta del giocatore.

| Risorsa | Colore | Ruolo |
|---------|--------|-------|
| **Fuel** | `0xccaa22` (oro) | Movimento unità, soprattutto corazzate |
| **Ammo** | `0x666666` (grigio) | Combattimento, picchi durante offensive |
| **Food** | `0x44aa44` (verde) | Consumo costante, tutte le unità |
| **Construction Parts** | `0xcc8833` (arancione) | Costruzione, upgrade, riparazioni |

---

## 3. Facility

2 tipi di facility: **Factory** e **Depot**. Entrambi upgradabili a 5 livelli.

### 3.1 Factory

Produce una singola risorsa. 4 sottotipi: Fuel Factory, Ammo Factory, Food Factory, Construction Parts Factory.

**Economie di scala**: livelli alti sono più efficienti in CP per unità di produzione, ma concentrano il rischio di bombardamento.

| Livello | Produzione/giorno | Costo CP (upgrade) | CP Totali Investiti | CP per unità prod. | Tempo Upgrade |
|---------|-------------------|---------------------|---------------------|---------------------|---------------|
| 1 | 10 | 20 (build) | 20 | 2.00 | 2 giorni |
| 2 | 25 | 25 | 45 | 1.80 | 3 giorni |
| 3 | 50 | 30 | 75 | 1.50 | 4 giorni |
| 4 | 85 | 35 | 110 | 1.29 | 6 giorni |
| 5 | 130 | 40 | 150 | 1.15 | 8 giorni |

- **Upgrade**: factory **ferma** durante l'upgrade (non produce)
- **Danno**: bombardamento riduce throughput di una percentuale. Produzione a capacità ridotta. Riparazione costa CP e tempo proporzionali al danno
- **Piazzamento**: su hex Urban o adiacente a hex Urban
- **Tensione design**: una factory lv5 (130/g per 150 CP, 1.15 CP/u) vs tre factory lv1 (30/g per 60 CP, 2.00 CP/u). La lv5 è il doppio più efficiente — ma un singolo bombardamento la ferma

### 3.2 Depot

Stocca risorse e le distribuisce alle unità nel raggio.

| Livello | Stoccaggio (per risorsa) | Throughput/giorno | Raggio (hex) | Max per unità/giorno | Costo CP | Tempo |
|---------|--------------------------|-------------------|--------------|----------------------|----------|-------|
| 1 | 50 | 60 | 5 | 5 | 15 | 1 giorno |
| 2 | 100 | 120 | 7 | 8 | 30 | 2 giorni |
| 3 | 180 | 200 | 9 | 12 | 50 | 3 giorni |
| 4 | 280 | 300 | 11 | 16 | 75 | 5 giorni |
| 5 | 400 | 420 | 13 | 20 | 105 | 7 giorni |

- **Stoccaggio**: capacità per ciascuna delle 3 risorse consumabili (Fuel, Ammo, Food). Un depot lv3 contiene fino a 180 Fuel + 180 Ammo + 180 Food. Construction Parts non transitano dai depot — vanno direttamente ai cantieri
- **Upgrade**: depot **fermo** durante l'upgrade (non distribuisce). Scorte restano dentro
- **Danno**: bombardamento riduce throughput percentualmente. Stoccaggio intatto (scorte non si perdono, escono solo più lentamente)
- **Piazzamento**: su qualsiasi hex passabile (non Water, non Mountain)

### 3.3 Distribuzione Depot

Algoritmo di distribuzione risorse dal depot alle unità:

1. Ogni unità nel raggio riceve risorse con **distance decay** — più lontana, meno riceve (fino a 0 al limite del raggio)
2. Cap **per unità** al giorno (colonna "Max per unità/giorno")
3. Cap **throughput totale** al giorno — se la domanda supera il cap, tutti i delivery scalano linearmente
4. Ogni unità si **auto-assegna** al depot che le può fornire di più

**Esempio**: Depot lv3, throughput 200/giorno, max per unità 12/giorno.
- 10 unità a distanza 2 → possono ricevere fino a 12/g ciascuna = 120 potenziale
- 10 unità a distanza 7 → possono ricevere fino a 5/g ciascuna = 50 potenziale
- Totale potenziale: 170. Sotto il cap 200 → ogni unità riceve il suo massimo distanza-adjusted
- Se il totale superasse 200, tutti i delivery scalerebbero linearmente (ognuno riceve la stessa proporzione)

---

## 4. Supply Line

Infrastruttura costruita **hex per hex** sulla mappa. Forma una rete ramificata con biforcazioni e incroci. Le risorse viaggiano fisicamente come **particelle** con tempo di transito reale.

| Livello | Capacità/giorno | Velocità (hex/ora) | Costo CP/hex | Tempo costruzione/hex |
|---------|-----------------|--------------------|--------------|-----------------------|
| 1 | 30 | 5 | 5 | 4 ore |
| 2 | 80 | 8 | 15 | 8 ore |
| 3 | 180 | 12 | 30 | 16 ore |
| 4 | 350 | 17 | 50 | 1 giorno |
| 5 | 600 | 24 | 80 | 2 giorni |

### Proprietà

- **Costruzione hex per hex**: il giocatore traccia un percorso. Ogni hex costa CP/hex del livello scelto. Una linea di 8 hex a lv2 = 8 × 15 = 120 CP
- **Rete ramificata**: biforcazioni e incroci liberi. Nodi dove si incontrano rami distribuiscono il flusso automaticamente
- **Collo di bottiglia**: la capacità effettiva è quella del segmento più debole lungo il percorso. La velocità del tratto più lento rallenta il transito su quel segmento
- **Upgrade**: segmento opera al **50%** della capacità durante l'upgrade. Velocità invariata
- **Danno localizzato**: bombardamento colpisce 1-3 hex specifici. Il segmento perde capacità percentuale. Se distrutto al 100%, il flusso cerca percorsi alternativi. Risorse in transito nel segmento distrutto vanno perse
- **Costo terreno**: hex River costa **2x CP** (ponte necessario). Hex Hills costa **1.5x CP**
- **Piazzamento**: su hex passabili (non Water, non Mountain)

### Tempo di Transito

Le risorse impiegano tempo reale a viaggiare. Factory a 60 hex da un depot con supply line lv3 (12 hex/ora) → tempo di transito = 5 ore. Con lv1 (5 hex/ora) → 12 ore. Con lv5 (24 hex/ora) → 2.5 ore.

Le risorse sono **in transito** nella supply line — una pipeline vera. Se un segmento viene distrutto mentre le risorse transitano, le risorse in quel tratto vengono perse.

### Feedback Visivo

- **Particelle fisiche**: ogni risorsa prodotta diventa una particella visibile (colore della risorsa) che viaggia hex per hex lungo la supply line
- **Ciclo di vita**: nasce alla factory → viaggia nella rete → rallenta ai colli di bottiglia → si accoda se saturo → arriva al depot (solo allora lo stock incrementa)
- **Saturazione leggibile dal flusso**: poche particelle sparse = sotto-utilizzata. Particelle ammassate e lente = satura/collo di bottiglia. Nessun colore artificiale sulla linea
- **Supply line neutra**: il visual della linea riflette solo il livello (spessore, stile), non il carico
- **Distruzione**: segmento distrutto → particelle nel tratto scompaiono, particelle a monte si fermano e accumulano
- **Bidirezionale**: se la linea trasporta in entrambe le direzioni, particelle visibili nei due sensi

---

## 5. Unità

Le unità militari sono il consumatore della logistica. Il giocatore non le controlla — combattono e si muovono automaticamente.

### Tipi e Consumo Base (per giorno, stato standby)

| Tipo | Simbolo NATO | Fuel/giorno | Ammo/giorno | Food/giorno |
|------|-------------|-------------|-------------|-------------|
| Infantry | X (croce diagonale) | 2 | 5 | 8 |
| Armor | Barra diagonale | 10 | 5 | 6 |
| Artillery | Cerchio pieno | 2 | 12 | 4 |

### Moltiplicatori per Stato

| Stato | Fuel | Ammo | Food |
|-------|------|------|------|
| **Standby** | 1x | 1x | 1x |
| **Difesa attiva** | 1.5x | 3x | 1x |
| **Movimento** | 4x | 0.5x | 1x |
| **Attacco** | 3x | 5x | 1.5x |
| **Ritirata** | 3x | 0.5x | 0.5x |

**Esempio**: divisione Armor in attacco = 10×3=30 Fuel, 5×5=25 Ammo, 6×1.5=9 Food al giorno.

### Echelon

| Echelon | Moltiplicatore | Forza Tipica |
|---------|---------------|-------------|
| Battalion | 1x | 300-1000 |
| Regiment | 3x | 2000-5000 |
| Division | 10x | 10000-20000 |
| Corps | 30x | 30000-80000 |

### Terreno

Le unità **non possono** occupare o attraversare hex Water o Mountain.

### Supply Bars

Ogni unità alleata mostra 3 barre (Fuel, Ammo, Food) che indicano quanti giorni di scorte ha. Pulsano se sotto il 20%.

---

## 6. Combattimento e Fronte

Il giocatore non combatte. Il fronte è una macchina autonoma che consuma risorse e si muove.

### Pressione Continua

Ogni hex di fronte ha una **forza** per lato (Alleato vs Nemico). La forza dipende da:
- Tipo e dimensione delle unità adiacenti
- Livello di supply (unità rifornite combattono meglio)
- Terreno (difensore in collina/foresta ha bonus)

### Efficacia Combattiva per Supply

| Supply Level | Efficacia |
|-------------|-----------|
| 80-100% | 100% |
| 60-79% | 75% |
| 40-59% | 50% |
| 20-39% | 25% — solo difesa, non può attaccare |
| 0-19% | 10% — collasso, ritirata automatica |

### Movimento del Fronte

Ogni tick si calcola il ratio di forza su ogni hex di fronte. Se un lato ha forza doppia, l'hex cambia mano. Il fronte si muove lentamente, hex per hex. Un'avanzata ampia richiede superiorità su molti hex contemporaneamente.

### Terreno Invalicabile

Le unità non possono occupare o attraversare hex Water o Mountain. Catene montuose e fiumi formano linee difensive naturali dove il fronte rallenta o si blocca.

### Conseguenze a Catena

Fronte avanza → unità si allontanano dai depot → supply cala → efficacia cala → fronte rallenta o si ritira. Il giocatore deve inseguire il fronte con nuovi depot e supply line.

### Vittoria e Sconfitta

- **Vittoria**: il nemico perde tutto il territorio
- **Sconfitta**: tu perdi tutto il territorio

---

## 7. Interdizione

Il nemico attacca la rete logistica. Sistema semplice — bombardamenti random. **Da approfondire in futuro.**

### Meccanica

Ogni tick c'è una probabilità che il nemico bombardi un bersaglio. La probabilità scala con:
- **Vicinanza al fronte** — strutture vicine al fronte colpite più spesso
- **Valore del bersaglio** — factory di livello alto e depot pieni attirano più attenzione
- **Densità** — zone con molte strutture ravvicinate hanno più probabilità

### Bersagli

| Bersaglio | Effetto | Costo Riparazione |
|-----------|---------|-------------------|
| Segmento supply line (1-3 hex) | Capacità ridotta o distrutta, risorse in transito perse | CP proporzionale al danno e livello |
| Factory | Produzione ridotta (% throughput perso) | CP proporzionale al danno |
| Depot | Throughput distribuzione ridotto (scorte intatte) | CP proporzionale al danno |

### Intensità

L'interdizione aumenta gradualmente durante la partita. All'inizio rara, verso la fine frequente. Nessun warning — il giocatore deve costruire ridondanza preventivamente.

### Riparazione

Il giocatore spende Construction Parts per riparare. La riparazione richiede tempo proporzionale al danno. Strutture danneggiate continuano a funzionare a capacità ridotta durante la riparazione.

---

## 8. Azioni del Giocatore

### Può fare

- **Costruire**: Factory (su Urban o adiacente), Depot (su hex passabile), Supply line (hex per hex su terreno passabile)
- **Upgradare** (lv1→5): Factory (ferma), Depot (fermo), Supply line (50% capacità)
- **Riparare**: qualsiasi struttura o segmento danneggiato (costa CP + tempo)
- **Controllare il tempo**: pausa, 1x, 2x, 4x
- **Osservare**: particelle, flussi, scorte, stato unità, fronte

### Non può fare

- Controllare le unità (automatiche)
- Controllare il combattimento (automatico)
- Spostare risorse già in transito
- Costruire su Water o Mountain
