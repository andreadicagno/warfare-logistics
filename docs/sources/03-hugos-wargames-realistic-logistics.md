# Enhancing Wargames with Realistic Logistics - Fonte di Ispirazione

**Autore**: Michael Hugos, SCM Globe Corporation
**Conferenza**: Connections 2020 (Center for Naval Analysis)
**File**: 2020 Hugos - Enhancing Wargames with Realistic Logistics.pdf

## Problema Centrale

I wargame tradizionali gestiscono la logistica solo in modo astratto, ma la logistica è il secondo fattore più critico dopo il coraggio dei soldati. Senza una simulazione logistica rigorosa, i risultati di un wargame potrebbero essere invalidati.

> "People not actually involved in logistics tend to take logistics for granted... There is often a feeling of 'Well really, how hard could it be?'"

## Framework delle 4 Entità

Il modello SCM Globe usa **4 classi di entità** per simulare supply chain:

1. **Products** (Prodotti)
   - Dimensioni e peso (es. container di munizioni)
   - Tipi: carburante, munizioni, cibo, ricambi

2. **Facilities** (Strutture)
   - Capacità di stoccaggio
   - Domanda interna di prodotti
   - Quantità disponibili
   - Es: depositi di rifornimento, dump di corpo d'armata

3. **Vehicles** (Veicoli)
   - Volume e peso del carico
   - Velocità
   - Es: "550 camion medi" come singola unità

4. **Routes** (Rotte)
   - Tempo di andata e ritorno
   - Distanza
   - Quantità di prodotti consegnati per viaggio

## Meccanica di Simulazione

- **Discrete Event Simulation (DES)** con modello deterministico non-lineare
- Integra tecniche agent-based con DES
- Mostra stato complessivo della rete E stato di ogni singola entità
- Può essere messa in pausa e riavviata
- Dati scaricabili per analisi

## Punti di Fallimento

La simulazione rivela automaticamente:
- Dove le scorte si esauriscono
- Dove si accumula troppo inventario
- Mismatch tra domanda e consegne effettive

**Obiettivo**: far funzionare la simulazione per 15-30 giorni (oltre è troppo incerto).

## Esempio: Battaglia di Smolensk 1941

- I corpi motorizzati (39° e 47°) avanzano molto → necessitano nuovi depositi intermedi
- I corpi non motorizzati (5° e 9°) avanzano poco → non serve spostare depositi
- Nuovi depositi devono essere posizionati a metà/due terzi della distanza percorsa
- Localizzazione basata su infrastruttura esistente (strade, ferrovie)

## Unified Game Board

Concetto di **tabellone unificato** che combina:
- Unità di combattimento (team operazioni)
- Unità logistiche (team logistica)

**Divisione del lavoro**:
- Umani: pensiero creativo, spostamento unità, decisioni strategiche
- Computer: calcoli, simulazioni, visualizzazione risultati

Se la logistica non può supportare un'operazione, l'operazione viene modificata.

## Processo M&OP (Mission & Operations Planning)

5 fasi collaborative:

1. **Mission Forecasting** → CONOPS (cosa fare, risorse da impiegare)
2. **Demand Planning** → definire domanda di prodotti per ogni struttura
3. **Supply Planning** → veicoli e rotte per consegnare prodotti
4. **Reconcile Plans** → riconciliare piano domanda e piano offerta
5. **Implement and Monitor** → implementare il piano migliore dalle simulazioni

Ciclo continuo: quando la situazione cambia, si torna al passo 1.

## Applicazioni per Game Design

### Metriche da Tracciare
- Costi operativi
- Livelli di inventario per struttura
- Giorni di autonomia
- Utilizzo dello stoccaggio

### Dinamiche di Gioco Interessanti
- Trade-off tra trasporto aereo (veloce, costoso) e marittimo (lento, economico)
- Necessità di stabilire depositi intermedi man mano che il fronte avanza
- Vincoli infrastrutturali reali (strade, ferrovie, ponti)
- Visibilità in tempo reale dei problemi guida il consenso di gruppo

### Insight Chiave
> "Simulations + Wargaming = Radar... probe through the fog of uncertainty and find the best ways forward as events unfold"

## Riferimenti Utili

- Phil Sabin, "Simulating War" (King's College London)
- SCM Globe: https://www.scmglobe.com/
- Caso studio Nepal: https://www.scmglobe.com/nepal-earthquake-disaster-response-supply-chain-2015/
