<div align="center">

# ♟ Chess Olympiad Flow

**An interactive visualization of team ranking progression throughout the 2026 Chess Olympiad.**

[![Status](https://img.shields.io/badge/status-in%20development-F0B429)](#roadmap)
[![JavaScript](https://img.shields.io/badge/JavaScript-frontend-F7DF1E?logo=javascript&logoColor=111111)](#tech-stack)
[![D3.js](https://img.shields.io/badge/D3.js-visualization-F9A03C?logo=d3&logoColor=ffffff)](#tech-stack)
[![Python](https://img.shields.io/badge/Python-data%20pipeline-3776AB?logo=python&logoColor=ffffff)](#tech-stack)
[![uv](https://img.shields.io/badge/uv-environment-DE5FE9)](#local-development)

</div>

---

## Overview

**Chess Olympiad Flow** visualizes how each team moves through the standings round by round during the 2026 Chess Olympiad.

Instead of reading each round's ranking table separately, the project connects every team's progression into a single interactive flow:

```text
Start → R1 → R2 → R3 → ... → R11
```

Each round node represents the team's result:

- 🟢 **Win**
- 🟡 **Draw**
- 🔴 **Loss**
- ⚪ **Not paired / special state**

The visualization is designed to keep roughly 200 teams visible at once while allowing one team and its match information to be explored interactively.

> The current implementation uses the **Open** tournament dataset. Support for the **Women** tournament is planned.

---

## Preview

The current interface includes:

- round-by-round ranking flow for all teams
- hover highlighting
- click-to-lock selection
- opponent-node highlighting for the selected round
- match-detail tooltips
- Korean / English UI toggle
- automatic display of the currently available round range

A screenshot and live GitHub Pages link will be added after the first public deployment.

---

## Features

### Visualization

- Displays the full tournament field in one ranking-flow graph
- Places teams according to their round-by-round official ranking order
- Separates tied teams into independent display slots to avoid node overlap
- Connects each team's ranking history with smooth D3 paths
- Uses result-colored round nodes for wins, draws, and losses

### Interaction

- Hover any node to highlight that team
- Click any node to keep the team highlighted
- Click outside the graph selection to clear the locked state
- Highlight the opponent's node for the same round
- Show match details in a tooltip
- Preserve a clicked selection while inspecting other nodes

### Localization

- Korean is the default interface language
- Toggle between **한국어** and **English**
- Localized page labels, legends, round information, and tooltips

### Data Handling

- Parses starting rank, round ranking, and team-pairing data
- Preserves official ranks from Chess-Results
- Handles special cases such as:
  - `bye`
  - `notPaired`
  - missing round records
  - tied rankings
- Validates round continuity and team identity during dataset generation

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Visualization | D3.js |
| Frontend | HTML, CSS, JavaScript |
| Data pipeline | Python, BeautifulSoup, Requests |
| Python environment | uv |
| Deployment target | Static web hosting / GitHub Pages |

Python is used only during the **data acquisition and preprocessing stage**.

The deployed website itself is static:

```text
HTML + CSS + JavaScript + JSON
```

No backend server or database is required.

---

## Architecture

```text
Chess-Results
     │
     ▼
Raw HTML
data/raw/<event>/
     │
     ▼
Python parsers
build_round.py
build_olympiad.py
     │
     ▼
Normalized JSON
data/processed/<event>/olympiad.json
     │
     ▼
D3.js
     │
     ▼
Interactive static website
```

---

## Project Structure

```text
chess-olympiad-flow/
├─ data/
│  ├─ processed/
│  │  └─ open/
│  │     ├─ round1.json
│  │     ├─ round2.json
│  │     ├─ ...
│  │     └─ olympiad.json
│  │
│  └─ raw/                     # ignored by Git
│
├─ scripts/
│  ├─ build_round.py
│  ├─ build_olympiad.py
│  └─ tournaments.py
│
├─ src/
│  └─ app.js
│
├─ index.html
├─ styles.css
├─ pyproject.toml
├─ uv.lock
└─ README.md
```

---

## Local Development

### Requirements

- [uv](https://docs.astral.sh/uv/)
- A modern web browser

### 1. Install the Python environment

```powershell
uv sync
```

### 2. Build a round

For example, to build Open Round 4:

```powershell
uv run python .\scripts\build_round.py open 4
```

This downloads and parses the relevant Chess-Results pages and writes:

```text
data/processed/open/round4.json
```

### 3. Build the combined tournament dataset

```powershell
uv run python .\scripts\build_olympiad.py open
```

Output:

```text
data/processed/open/olympiad.json
```

### 4. Start a local web server

```powershell
uv run python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

---

## Data Model

The combined dataset contains tournament metadata and one record per team.

Example:

```json
{
  "id": 74,
  "name": "South Korea",
  "federation": "KOR",
  "startRank": 74,
  "rounds": [
    {
      "round": 1,
      "rank": 51,
      "opponentId": 177,
      "scoreFor": 4.0,
      "scoreAgainst": 0.0,
      "result": "W",
      "status": "played"
    }
  ]
}
```

### Team identity

`id` is the Chess-Results tournament-local team identifier.

It must **not** be treated as a global identifier across the Open and Women tournaments.

Conceptually, a team record belongs to:

```text
(event, team_id)
```

---

## Ranking Layout

The source ranking is never modified.

However, multiple teams may share the same official rank. Rendering those teams at the exact same Y coordinate would make their nodes overlap.

Chess Olympiad Flow therefore separates:

```text
official rank
```

from:

```text
display slot
```

For example:

```text
Official rank     Display slot
-------------     ------------
5  France         5
5  Armenia        6
5  England        7
8  Türkiye        8
```

The original rank remains `5` for all three tied teams.  
Only their screen positions are separated for readability.

---

## Special Match States

The pipeline explicitly preserves tournament states that are not ordinary played matches.

### Bye

```json
{
  "opponentId": null,
  "scoreFor": 2.0,
  "scoreAgainst": 0.0,
  "result": "W",
  "status": "bye"
}
```

### Not paired

```json
{
  "opponentId": null,
  "scoreFor": null,
  "scoreAgainst": null,
  "result": null,
  "status": "notPaired"
}
```

Missing round data is kept distinct from both cases.

---

## Data Source

Tournament information is collected from:

**[Chess-Results](https://chess-results.com/)**

The pipeline currently uses:

- Starting rank
- Ranking after each round
- Team pairings
- Team scores
- Tournament-local team IDs

Raw downloaded HTML is stored under:

```text
data/raw/
```

and is excluded from Git.

The web application reads only normalized processed JSON.

---

## Roadmap

### P1 — Data Specification & Acquisition

- [x] Parse tournament ranking data
- [x] Parse team pairing data
- [x] Build normalized round JSON
- [x] Build combined tournament JSON
- [x] Support tournament-specific data directories

### P2 — Core Visualization

- [x] Create round-by-round team nodes
- [x] Rank-based node placement
- [x] Connect each team's round history
- [x] Visualize win / draw / loss results

### P3 — Interaction & UI

- [ ] Team search and selection
- [x] Team highlighting
- [x] Node hover interaction
- [x] Click-to-lock selection
- [x] Opponent round-node highlighting
- [x] Match-detail tooltip
- [x] Korean / English language toggle
- [x] Initial page design and legend

### P4 — Validation & Refinement

- [x] Validate normalized data against real tournament records
- [x] Test readability with roughly 200 teams
- [ ] Improve visibility when an opponent node is far off-screen
- [ ] Add country flags to Start nodes
- [ ] Final visual and responsive refinement

### P5 — Release & Sharing

- [ ] Add Women tournament data
- [ ] Publish with GitHub Pages
- [ ] Add project screenshot and live-demo link
- [ ] Share the visualization publicly

---

## Current Status

The project currently supports:

```text
2026 Chess Olympiad
└─ Open
   ├─ normalized tournament data
   ├─ interactive ranking-flow visualization
   ├─ match tooltips
   ├─ team highlighting
   └─ Korean / English interface
```

The tournament is still in progress, so the processed dataset is extended as official round rankings become available.

---

<div align="center">

Built as a data-visualization project for exploring the 2026 Chess Olympiad.

</div>

