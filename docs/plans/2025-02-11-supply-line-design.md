# Supply Line - Game Design Document

**Data**: 2025-02-11
**Stato**: Approvato per sviluppo MVP

---

## 1. Concept e Visione

### Elevator Pitch

Un gioco di strategia dove non combatti la guerra - la tieni in vita. Gestisci l'intera rete logistica di un teatro della Seconda Guerra Mondiale: costruisci depositi, tracci ferrovie, produci convogli e mantieni milioni di soldati riforniti mentre il fronte si muove e il nemico bombarda le tue linee.

### Fantasy del Giocatore

Sei il generale che nessuno conosce. I comandanti in prima linea ricevono medaglie, ma tu sai che senza il tuo lavoro non avrebbero né proiettili né benzina. La soddisfazione viene dal vedere un sistema complesso funzionare - e dal salvarlo quando sta per collassare.

### Unicità

A differenza di altri wargame dove la logistica è un vincolo fastidioso, qui È il gioco. A differenza di Factorio o supply chain simulators, qui il "cliente" è una guerra viva che si muove, attacca e viene attaccata. Il fronte non è statico: è una bestia affamata che devi inseguire.

### Riferimenti Chiave

- *SCM Globe* per il sistema a flusso e le 4 entità
- *Gary Grigsby's War in the East* per la profondità strategica WW2
- *Factorio* per la soddisfazione di sistemi che funzionano
- Analisi logistica Ucraina/Barbarossa per il realismo dei vincoli

---

## 2. Specifiche di Design

| Aspetto | Scelta |
|---------|--------|
| Esperienza core | "Tengo in piedi la guerra" + puzzle solving |
| Ruolo giocatore | Solo logistica, nessun controllo combattimento |
| Combattimento | Sistema procedurale (guerra come macchina che consuma) |
| Scala | Strategica (teatro/nazione) |
| Tempo | Real-time con pausa |
| Ambientazione | Seconda Guerra Mondiale |
| Risorse | 4 categorie: Carburante, Munizioni, Cibo, Ricambi |
| Trasporto | Sistema a flusso/pipeline (progetta rete, flusso automatico) |
| Sfide | Interdizione + fronte dinamico + vincoli capacità |
| Feedback | Misto (visivo su mappa + pannelli numerici) |
| Vittoria | Nemico perde tutto il territorio |
| Sconfitta | Tu perdi tutto il territorio |
| Modalità | Single-player puro |

---

## 3. Core Gameplay Loop

### Loop Immediato (secondi/minuti)

- Osserva la mappa: rotte verdi/gialle/rosse, depositi pieni/vuoti
- Identifica problemi: un deposito si sta svuotando, una rotta è congestionata
- Intervieni: reindirizza un convoglio, aumenta priorità, ripara un ponte bombardato
- Verifica: il flusso si ristabilisce, il problema rientra

### Loop Tattico (minuti/ore di gioco)

- Il fronte avanza: le unità si allontanano dai depositi esistenti
- Pianifica espansione: dove costruire il prossimo deposito? Estendere la ferrovia o usare camion?
- Costruisci e assegna: nuova infrastruttura, nuovi veicoli sulle rotte
- Bilancia: le risorse per costruire vengono dalle stesse fabbriche che producono rifornimenti

### Loop Strategico (ore di gioco)

- Leggi l'andamento della guerra: il fronte sta per lanciare un'offensiva? Si prepara una difesa?
- Anticipa: accumula scorte nei settori chiave, costruisci ridondanza
- Adatta la rete: riorganizza per la nuova forma del fronte
- Affronta le conseguenze: le scelte fatte ore fa determinano se l'offensiva ha carburante

**Tensione**: questi loop confliggono. Risolvere un problema immediato può compromettere la preparazione strategica. Costruire per il futuro significa accettare inefficienze nel presente.

---

## 4. Le Quattro Entità

### 4.1 Prodotti (Risorse)

| Risorsa | Caratteristiche | Comportamento |
|---------|-----------------|---------------|
| **Carburante** | Liquido, infiammabile | Si consuma nel trasporto. Depositi vulnerabili a incendi. Critico per unità motorizzate. |
| **Munizioni** | Pesante, esplosivo | Domanda variabile: picchi durante offensive e difesa attiva. Depositi esplosivi se colpiti. |
| **Cibo** | Deperibile, voluminoso | Consumo costante e prevedibile. Se manca, il morale crolla prima che le unità muoiano. |
| **Ricambi** | Vario, specifico | Necessari per mantenere veicoli operativi. Senza ricambi, i camion si fermano e la rete stessa degrada. |

**Interazione chiave**: i ricambi servono anche per la flotta logistica. Se dai priorità ai ricambi per il fronte, i tuoi camion si rompono. Se li tieni per te, le unità combattenti perdono carri armati.

### 4.2 Strutture (Facilities)

| Struttura | Funzione | Attributi |
|-----------|----------|-----------|
| **Deposito** | Stoccaggio risorse | Capacità, throughput, livello (avanzato/intermedio/principale) |
| **Fabbrica** | Produce veicoli e processa risorse | Produzione/giorno, tipi producibili, costo operativo |
| **Hub ferroviario** | Nodo di smistamento | Throughput, connessioni, vulnerabilità |
| **Porto** | Ingresso risorse via mare | Throughput, capacità attracco, vulnerabilità |

Ogni struttura ha: capacità, throughput massimo, costo di costruzione, tempo di costruzione, vulnerabilità.

### 4.3 Veicoli

| Veicolo | Capacità | Velocità | Costo | Caratteristiche |
|---------|----------|----------|-------|-----------------|
| **Camion** | Bassa | Alta | Basso | Flessibile, va ovunque ci sia strada. Consuma carburante. Vulnerabile a imboscate. |
| **Treno** | Altissima | Media | Alto | Solo su ferrovia. Efficiente ma rigido. Richiede hub di carico/scarico. |
| **Convoglio navale** | Enorme | Lenta | Medio | Porto-a-porto. Vulnerabile a sottomarini e aerei. (Post-MVP) |
| **Trasporto aereo** | Minima | Altissima | Altissimo | Per emergenze. Costoso e limitato. (Post-MVP) |

**Meccanica chiave**: i veicoli si usurano. Un camion che viaggia costantemente degrada e alla fine si rompe. Servono ricambi e rotazione.

### 4.4 Rotte

| Tipo Rotta | Costruzione | Capacità | Vulnerabilità |
|------------|-------------|----------|---------------|
| **Strada** | Veloce, economica | Limitata (congestione) | Fango, neve, imboscate |
| **Ferrovia** | Lenta, costosa | Alta | Bombardamenti, ponti |
| **Rotta marittima** | Nessuna (esiste) | Illimitata* | Sottomarini, mine (Post-MVP) |
| **Rotta aerea** | Nessuna (esiste) | Dipende da aerei | Caccia nemici, meteo (Post-MVP) |

**Sistema a flusso**: assegni veicoli a una rotta, definisci cosa trasportano e con che priorità. Il sistema ottimizza. Tu progetti l'architettura, non microgestisci ogni viaggio.

---

## 5. Il Fronte (La Macchina della Guerra)

### 5.1 Come Funziona

Il fronte è simulato procedurale con regole semplici ma emergenti:

- **Unità**: divisioni/corpi con attributi (forza, morale, equipaggiamento)
- **Consumo**: ogni unità consuma risorse in base al suo stato
- **Combattimento**: risolto automaticamente in base a forza, morale, terreno, rifornimenti

### 5.2 Stati delle Unità e Consumo

| Stato Unità | Carburante | Munizioni | Cibo | Ricambi |
|-------------|------------|-----------|------|---------|
| **Attacco** | Alto | Molto alto | Normale | Alto |
| **Movimento** | Molto alto | Basso | Normale | Normale |
| **Difesa attiva** | Basso | Alto | Normale | Normale |
| **Difesa standby** | Minimo | Minimo | Normale | Basso |
| **In rotta/ritirata** | Alto | Basso | Basso | Persi |

### 5.3 Effetti della Logistica sul Fronte

| Stato Rifornimenti | Effetto sull'Unità |
|--------------------|--------------------|
| **100%** | Piena efficacia, può attaccare |
| **70-99%** | Efficacia ridotta, attacchi limitati |
| **40-69%** | Solo difesa, morale cala |
| **10-39%** | Difesa debole, diserzioni, ritirata |
| **<10%** | Collasso: l'unità si arrende o viene distrutta |

**Feedback loop**: unità ben rifornite avanzano → conquisti territorio → linee si allungano → logistica più difficile.

### 5.4 Feedback dal Fronte

Il fronte "comunica" con il giocatore:
- **Richieste**: "3ª Armata richiede aumento priorità munizioni per offensiva"
- **Allarmi**: "7° Corpo sotto il 30% carburante"
- **Conseguenze**: "Offensiva nel settore Nord fallita per mancanza rifornimenti"

---

## 6. Sfide e Disruption

### 6.1 Interdizione Nemica

- **Bombardamenti strategici**: colpiscono hub ferroviari, depositi, fabbriche
- **Attacchi tattici**: colpiscono ponti, convogli in movimento
- **Partigiani/incursioni**: sabotano ferrovie e strade nelle retrovie (Post-MVP)

### 6.2 Fronte Dinamico

- **Avanzata**: linee di rifornimento si allungano, servono nuovi depositi
- **Ritirata**: rischi di perdere depositi, scorte catturate dal nemico
- **Accerchiamento**: unità tagliate fuori, solo trasporto aereo può raggiungerle (Post-MVP)

### 6.3 Vincoli Sistemici

- **Scarsità alla fonte**: fabbriche producono a ritmo finito
- **Colli di bottiglia**: hub ferroviari, ponti, valichi montani
- **Competizione tra armate**: risorse limitate, richieste infinite

---

## 7. Interfaccia e Feedback

### 7.1 Mappa Strategica (Vista Principale)

**Rotte** - colore indica salute:
- 🟢 Verde: flusso regolare, capacità sufficiente
- 🟡 Giallo: congestione o flusso ridotto
- 🔴 Rosso: bloccata, danneggiata o sovraccarica
- ⚫ Grigio: inattiva o distrutta

**Depositi** - indicatore riempimento:
- Barra verticale per ogni risorsa (4 barre: C/M/F/R)
- Lampeggio se sotto soglia critica
- Icona danno se colpito

**Unità al fronte** - indicatore stato:
- Cerchio pieno: rifornita
- Cerchio parziale: in difficoltà
- Cerchio vuoto lampeggiante: critico

**Flussi animati**: linee tratteggiate mostrano direzione e volume.

### 7.2 Pannelli Dettaglio (On-Demand)

Click su qualsiasi elemento apre pannello laterale con:
- Statistiche dettagliate
- Grafici storici
- Connessioni e dipendenze
- Azioni disponibili

### 7.3 Sistema di Notifiche

| Livello | Trigger | Comportamento |
|---------|---------|---------------|
| **Critico** | Unità sotto 20%, deposito vuoto, rotta distrutta | Pop-up + suono + pausa automatica opzionale |
| **Allarme** | Sotto 40%, congestione grave, bombardamento | Icona lampeggiante, log laterale |
| **Info** | Costruzione completata, richiesta armata | Solo log laterale |

---

## 8. Modalità Sandbox (MVP)

### 8.1 Generazione Mappa

**Opzioni di setup**:
- Dimensione: Piccola / Media / Grande
- Geografia: Pianura / Mista / Montagnosa
- Infrastruttura iniziale: Nessuna / Base / Sviluppata
- Fronte: Statico / Lento / Dinamico / Caotico

### 8.2 Parametri di Simulazione

| Parametro | Range | Effetto |
|-----------|-------|---------|
| Consumo risorse | 0.5x - 2x | Quanto velocemente le unità consumano |
| Intensità combattimenti | Bassa - Alta | Frequenza e violenza degli scontri |
| Interdizione nemica | Nulla - Brutale | Frequenza bombardamenti |
| Velocità fronte | Statico - Blitzkrieg | Quanto si muovono le linee |
| Risorse iniziali | Scarse - Abbondanti | Budget di partenza |

### 8.3 Condizioni Vittoria/Sconfitta

- **Vittoria**: Il nemico perde tutto il territorio
- **Sconfitta**: Tu perdi tutto il territorio

---

## 9. Scope MVP

### Incluso nel MVP

- Mappa 2D generata proceduralmente
- 4 risorse (Carburante, Munizioni, Cibo, Ricambi)
- 3 tipi strutture (Deposito, Fabbrica, Hub ferroviario)
- 2 tipi veicoli (Camion, Treno)
- 2 tipi rotte (Strada, Ferrovia)
- Sistema flusso automatico base
- Fronte procedurale semplificato
- Interdizione base (bombardamenti)
- UI mappa con indicatori colore
- Pannello dettaglio essenziale
- Modalità sandbox con parametri configurabili

### Escluso dal MVP (Fase Successiva)

- Porti e trasporto navale
- Trasporto aereo
- Partigiani e sabotaggio
- Meteo e stagioni
- Scenari storici
- Audio
- Tutorial

---

## 10. Stack Tecnologico

### Scelta: TypeScript + Web

| Componente | Tecnologia |
|------------|------------|
| Linguaggio | TypeScript |
| Build tool | Vite |
| Rendering | PixiJS |
| Struttura | Modulare (core/game/ui/data) |

### Architettura Cartelle

```
src/
├── core/       → Logica simulazione (risorse, flussi, fronte)
├── game/       → Game loop, stato, eventi
├── ui/         → Rendering mappa, pannelli, input
└── data/       → Tipi, configurazioni, parametri
```

### Motivazione

- TypeScript: Claude Code eccelle, type safety
- Vite: Hot reload, feedback immediato
- PixiJS: Rendering 2D performante
- Web: Nessuna installazione, debug facile con DevTools

---

## 11. Fonti di Ispirazione

Documentate in `docs/sources/`:

1. **OpenFrontIO** - RTS browser-based, architettura di riferimento
2. **Russian Logistics Ukraine** - Vincoli logistici reali moderni
3. **Hugos - Wargames with Realistic Logistics** - Framework SCM Globe
4. **Games with Logistics** - Analisi 12+ giochi esistenti
5. **Historical Logistics Campaigns** - 10 campagne storiche
6. **Academic Logistics Resources** - Paper e simulatori professionali
7. **Gamedev Talks Resources** - GDC talks e principi di design
