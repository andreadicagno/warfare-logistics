# Map Visual Game Elements - Design Document

**Data**: 2025-02-11
**Stato**: Approvato per sviluppo

---

## Obiettivo

Implementare tutti gli elementi visivi del gameplay sulla mappa con dati mock, così che l'intera UI sia completa prima di collegare le logiche di gioco reali. Sei elementi:

1. Territorio alleato/nemico (tinta hex)
2. Linea del fronte
3. Unità militari (simboli NATO)
4. Depositi con barre risorse
5. Rotte con colore salute + flussi animati (particelle)
6. Veicoli in movimento (camion/treni)

---

## 1. MockSimulation

Modulo in `src/core/mock/` che genera e aggiorna dati finti coerenti.

### Generazione iniziale

- **Territorio**: mappa divisa ~a metà verticale con boundary ondulato (rumore). Hex di terra a sinistra = alleati, a destra = nemici. Acqua e montagne neutri.
- **Unità**: 8-12 alleate e 6-8 nemiche piazzate 1-3 hex dal confine.
- **Depositi**: stoccaggio randomizzato 30-100%. Gradiente naturale: retrovie piene, fronte in sofferenza. 1-2 depositi "danneggiati".
- **Rotte**: salute basata su posizione — retrovie verdi, verso il fronte gialle/rosse. 1-2 distrutte (grigio).
- **Veicoli**: 2-4 per rotta attiva, zero su rotte distrutte. ~30-50 totali.

### Aggiornamento continuo (ticker)

| Cosa | Frequenza | Comportamento |
|------|-----------|---------------|
| Posizioni veicoli | Ogni frame | Avanzamento lungo curva Bézier |
| Posizioni particelle | Ogni frame | Spawn/despawn, scorrimento lungo rotte |
| Risorse depositi | Ogni ~2s | Consumo lento, depositi vicino al fronte si svuotano |
| Rifornimenti unità | Ogni ~10s | Fluttuazione livelli |
| Movimento fronte | Ogni ~30s | 1-2 hex in direzione casuale |

---

## 2. Territory & Front Line

### TerritoryLayer

- Overlay semitrasparente sugli hex di terra (no acqua, no montagne)
- Blu chiaro (~15% opacità) per alleati
- Rosso chiaro (~15% opacità) per nemici
- Si rebuilda solo quando il fronte si muove

### FrontLineLayer

- Linea spessa (3-4px) che segue gli edge degli hex al confine tra territori
- Colore contrastante (bianco/nero con bordo) per leggibilità su qualsiasi terreno
- Passa lungo i bordi degli hex, non attraverso i centri
- Si rebuilda insieme a TerritoryLayer

---

## 3. Unità Militari (UnitLayer)

### Aspetto visivo — Simboli NATO

- Rettangolo con bordo spesso, sfondo colore fazione (blu alleato, rosso nemico)
- Simbolo tipo unità dentro il rettangolo:
  - **X** = Fanteria
  - **Cerchio** = Corazzati
  - **Punto** = Artiglieria
- Designazione testuale sotto il rettangolo (es. "3rd Arm", "7° Corp")

### Indicatore rifornimento (solo unità alleate)

- Barra orizzontale sottile sotto il rettangolo NATO
- 4 segmenti colorati:
  - Giallo = Carburante
  - Grigio scuro = Munizioni
  - Verde = Cibo
  - Arancio = Ricambi
- Riempimento proporzionale al livello
- Sotto 40%: pulsazione lenta
- Sotto 20%: pulsazione veloce

### Fog of war leggero

- Unità nemiche visibili ma opache, senza dettagli rifornimenti
- Solo unità alleate sono interattive (futuro)

### Mock data

- Livelli rifornimento randomizzati per unità
- Alcune al 100%, alcune 40-60%, 1-2 sotto 20% (per testare lampeggio)
- Consumo lento nel tempo

---

## 4. Depositi Potenziati (SupplyHubLayer — refactor)

### Icone per tipo struttura

| Tipo | Icona |
|------|-------|
| **Deposito** | Quadrato con croce interna |
| **Fabbrica** | Quadrato con ingranaggio stilizzato |
| **Hub ferroviario** | Quadrato con simbolo binari |

### Barre risorse

- 4 barre verticali affiancate sopra l'icona
- Altezza ~12px, larghezza ~3px ciascuna
- Colori: giallo (carburante), grigio scuro (munizioni), verde (cibo), arancio (ricambi)
- Riempimento dal basso verso l'alto
- Sotto 20%: barra lampeggia

### Dimensioni

- Strutture "large" (città): icona più grande, capacità maggiore
- Strutture "small": icona ridotta, barre più piccole

### Danno

- 1-2 depositi mock "danneggiati"
- Overlay rosso semitrasparente + piccolo simbolo esplosione
- Throughput ridotto visivamente

### Mock data

- Livelli casuali 30-100% all'avvio
- Depositi vicino al fronte si svuotano gradualmente
- Depositi nelle retrovie restano pieni → gradiente visivo naturale

---

## 5. Rotte — Colore Salute + Flussi Animati

### Colore salute (modifica RouteLayer esistente)

| Stato | Colore fill | Significato |
|-------|-------------|-------------|
| Verde | `#4a8c3f` | Flusso regolare, capacità sufficiente |
| Giallo | `#c8a832` | Congestione o flusso ridotto |
| Rosso | `#b83a3a` | Sovraccarica o danneggiata |
| Grigio | `#666666` | Inattiva o distrutta |

- Colore applicato al fill della rotta (linea interna)
- Bordo resta scuro per leggibilità
- Ferrovie mantengono traversine ma cambiano colore
- Mock: retrovie verdi, verso il fronte gialle/rosse, 1-2 distrutte

### FlowLayer — Particelle animate

- Piccoli cerchi (2-3px) scorrono lungo la curva Bézier delle rotte
- Direzione: da deposito retrovie verso il fronte
- **Densità**: più particelle = più volume (verdi molte, gialle meno, rosse pochissime)
- **Velocità**: ~60px/s, leggermente più lente su rotte congestionate
- **Colore**: bianco semitrasparente, uniforme (non distinguiamo tipo risorsa)
- **Ciclo**: nascono a un capo, scorrono, scompaiono all'altro. Loop continuo.
- Rotte grigie (distrutte): nessuna particella
- Rotte rosse: particelle a singhiozzo — piccoli gruppi con pause

---

## 6. Veicoli in Movimento (VehicleLayer)

### Tipi

| Veicolo | Forma | Dove |
|---------|-------|------|
| **Camion** | Rettangolino con cabina davanti | Strade |
| **Treno** | Rettangolo lungo + 1-2 vagoni in fila | Ferrovie |

### Comportamento

- Percorso avanti e indietro sulla rotta (andata carico, ritorno vuoto)
- Segue la curva Bézier, orientandosi lungo la tangente
- Camion più veloci, treni più lenti
- 2-4 veicoli per rotta attiva, zero su rotte distrutte

### Visibilità per zoom

- Zoom < 0.5x: veicoli nascosti (troppo piccoli)
- Si vedono solo le particelle di flusso a zoom basso

### Mock data

- ~30-50 veicoli totali sulla mappa
- Rotte principali (verdi) più veicoli, secondarie 1-2
- Nessuna interazione (puramente decorativi)

---

## 7. Architettura — Layer Stack

Ordine di rendering dal basso verso l'alto:

```
1. TerrainLayer        (esistente)
2. TerritoryLayer      (NUOVO — tinta blu/rossa)
3. RouteLayer          (esistente, modificato per colore salute)
4. FlowLayer           (NUOVO — particelle animate)
5. VehicleLayer        (NUOVO — camion e treni)
6. SupplyHubLayer      (esistente, refactor con icone + barre)
7. FrontLineLayer      (NUOVO — linea di fronte)
8. UnitLayer           (NUOVO — simboli NATO)
9. SelectionLayer      (esistente)
```

### Pattern rendering

| Layer | Pattern | Rebuild |
|-------|---------|---------|
| TerritoryLayer | Build once, cache | Solo quando fronte si muove |
| FrontLineLayer | Build once, cache | Solo quando fronte si muove |
| UnitLayer | Build once, cache | Quando fronte si muove o rifornimenti cambiano visibilmente |
| SupplyHubLayer | Build once, cache | Quando livelli risorse cambiano visibilmente |
| RouteLayer | Build once, cache | Solo se stato salute cambia |
| FlowLayer | **Update ogni frame** | `update(dt)` dal ticker |
| VehicleLayer | **Update ogni frame** | `update(dt)` dal ticker |

### Sidebar — Nuovi toggle

5 nuovi checkbox nella sezione "Layers":
- Territory
- Front Line
- Units
- Flows
- Vehicles

Tutti accesi di default.

---

## 8. File e moduli coinvolti

### Nuovi file

```
src/core/mock/
├── MockSimulation.ts      # Genera e aggiorna tutti i dati mock
├── types.ts               # Tipi per dati mock (territorio, unità, etc.)
└── __tests__/             # Test per generazione mock

src/ui/layers/
├── TerritoryLayer.ts      # Tinta hex alleato/nemico
├── FrontLineLayer.ts      # Linea di fronte
├── UnitLayer.ts           # Simboli NATO unità militari
├── FlowLayer.ts           # Particelle animate sulle rotte
└── VehicleLayer.ts        # Camion e treni in movimento
```

### File da modificare

```
src/ui/layers/SupplyHubLayer.ts   # Refactor: icone tipo + barre risorse
src/ui/layers/RouteLayer.ts       # Modifica: colore salute dinamico
src/ui/MapRenderer.ts             # Aggiungere nuovi layer + update loop
src/ui/Sidebar.ts                 # 5 nuovi toggle layer
src/game/Game.ts                  # Integrare MockSimulation nel ticker
```
