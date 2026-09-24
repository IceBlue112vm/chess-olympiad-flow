<div align="center">

# ♟ Chess Olympiad Flow

**An interactive visualization of team ranking progression throughout the 2026 Chess Olympiad.**

[![Status](https://img.shields.io/badge/status-completed-4CAF50)](#project-status)
[![JavaScript](https://img.shields.io/badge/JavaScript-frontend-F7DF1E?logo=javascript&logoColor=111111)](#tech-stack)
[![D3.js](https://img.shields.io/badge/D3.js-visualization-F9A03C?logo=d3&logoColor=ffffff)](#tech-stack)
[![Python](https://img.shields.io/badge/Python-data%20pipeline-3776AB?logo=python&logoColor=ffffff)](#tech-stack)
[![uv](https://img.shields.io/badge/uv-environment-DE5FE9)](#local-development)

**[View Visualization](https://iceblue112vm.github.io/chess-olympiad-flow/)**

</div>

---

## Overview

**Chess Olympiad Flow** visualizes how national teams move through the standings during the 2026 Chess Olympiad.

Instead of reading a separate ranking table, pairing page, and team page for every round, the project connects each team's tournament journey into one interactive flow:

```text
Start → R1 → R2 → R3 → ... → R11 → Final
```

The graph is built around **pre-round ranking state**:

- `Start` = starting rank
- `R1` = rank entering Round 1
- `R2` = rank after Round 1 / entering Round 2
- ...
- `R11` = rank after Round 10 / entering Round 11
- `Final` = final rank after Round 11

A round node also carries that round's match information. Completed matches are colored by result, while an announced-but-unplayed pairing can already be explored before a result exists.

The visualization supports both the **Open** and **Women** tournaments.

---

## Features

### Visualization

- Displays the full tournament field in one ranking-flow graph
- Preserves official Chess-Results rankings
- Separates tied teams into independent display slots to avoid visual overlap
- Connects each team's ranking history with smooth D3 paths
- Uses result-colored round nodes:
  - 🟢 **Win**
  - 🟡 **Draw**
  - 🔴 **Loss**
  - ⚪ **Upcoming / special state**
- Shows a dedicated `Final` stage after Round 11
- Displays federation flags on Start nodes
- Highlights South Korea labels for easier tracking

### Interaction

- Hover a node to inspect a team and its match
- Click a node to keep the selection locked
- Click outside the selection to clear it
- Highlight the opponent node for the same round
- Draw a match connector between paired teams
- Preserve the selected team while temporarily inspecting another node
- Show board-by-board player results for completed matches
- Show team rosters and ratings from Start nodes

### Interface

- Toggle between **Open** and **Women**
- Toggle between **한국어** and **English**
- Localized team names in Korean where available
- Persistent light / dark theme
- Responsive tooltip positioning within the viewport
- Public visitor counters

---

## Data Pipeline

Tournament data is collected from **[Chess-Results](https://chess-results.com/)** and normalized before being used by the frontend.

The pipeline handles four different kinds of tournament data:

- starting rank
- team roster
- pre-round team pairings
- completed round results, rankings, and board results

Pairings and completed results are intentionally kept separate.

```text
Pairing announced
      │
      ▼
build_pairings.py
      │
      ▼
pairingsN.json
      │
      ├──────────────┐
      │              │
Round completed      │
      │              │
      ▼              │
build_round.py       │
      │              │
      ▼              │
roundN.json          │
      │              │
      └──────┬───────┘
             ▼
     build_olympiad.py
             │
             ▼
       olympiad.json
             │
             ▼
           D3.js
             │
             ▼
  Interactive static website
```

This makes it possible to show a newly announced pairing before the game is played, without pretending that result data already exists.

---

## Tournament Update Lifecycle

### When a pairing is announced

For example, Round 8:

```powershell
uv run python .\scripts\build_pairings.py open 8
uv run python .\scripts\build_olympiad.py open

uv run python .\scripts\build_pairings.py women 8
uv run python .\scripts\build_olympiad.py women
```

The current round node keeps the team's pre-round rank and gains its scheduled opponent.

### When a round is completed

For example, Round 8:

```powershell
uv run python .\scripts\build_round.py open 8
uv run python .\scripts\build_olympiad.py open

uv run python .\scripts\build_round.py women 8
uv run python .\scripts\build_olympiad.py women
```

The completed round data adds:

- official post-round rank
- team score
- win / draw / loss result
- match status
- board-by-board results

That post-round rank becomes the pre-round position of the next stage.

After Round 11, the lifecycle ends at `Final` rather than creating a nonexistent Round 12.

---

## Data Model

The combined dataset contains tournament metadata plus team records.

A simplified team record looks like:

```json
{
  "id": 74,
  "name": "South Korea",
  "federation": "KOR",
  "startRank": 74,
  "players": [
    {
      "order": 1,
      "title": "IM",
      "name": "Lee, Junhyeok",
      "rating": 2401
    }
  ],
  "rounds": [
    {
      "round": 1,
      "rank": 51,
      "opponentId": 177,
      "scoreFor": 4.0,
      "scoreAgainst": 0.0,
      "result": "W",
      "status": "played",
      "boards": [
        {
          "board": 1,
          "player": "Lee, Junhyeok",
          "playerTitle": "IM",
          "scoreFor": "1",
          "scoreAgainst": "0",
          "opponent": "Opponent Name",
          "opponentTitle": ""
        }
      ]
    }
  ]
}
```

### Upcoming pairing state

An upcoming round is stored separately from completed rounds:

```json
{
  "upcomingRound": {
    "round": 8,
    "pairings": [
      {
        "id": 74,
        "opponentId": 21,
        "status": "scheduled"
      }
    ]
  }
}
```

Upcoming pairings contain no fabricated score, result, board result, or post-round rank.

### Team identity

`id` is a **tournament-local Chess-Results team identifier**.

It must not be treated as a global identifier across the Open and Women tournaments.

Conceptually, team identity is:

```text
(event, team_id)
```

---

## Ranking Layout

The source ranking is never modified.

Multiple teams can share the same official rank, so rendering every tied team at the exact same Y coordinate would make nodes overlap.

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

The official rank remains `5` for all three tied teams. Only their screen positions are separated for readability.

---

## Special Match States

The pipeline preserves tournament states that are not ordinary played matches.

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

Missing data is kept distinct from both states.

---

## Project Structure

```text
chess-olympiad-flow/
├─ data/
│  ├─ processed/
│  │  ├─ open/
│  │  │  ├─ roundN.json
│  │  │  ├─ pairingsN.json
│  │  │  ├─ rosters.json
│  │  │  └─ olympiad.json
│  │  └─ women/
│  │     ├─ roundN.json
│  │     ├─ pairingsN.json
│  │     ├─ rosters.json
│  │     └─ olympiad.json
│  └─ raw/                     # ignored by Git
│
├─ scripts/
│  ├─ build_pairings.py
│  ├─ build_rosters.py
│  ├─ build_round.py
│  ├─ build_olympiad.py
│  └─ tournaments.py
│
├─ src/
│  ├─ app.js
│  └─ team-names.js
│
├─ index.html
├─ styles.css
├─ pyproject.toml
├─ uv.lock
└─ README.md
```

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Visualization | D3.js |
| Frontend | HTML, CSS, JavaScript |
| Data pipeline | Python, BeautifulSoup, Requests |
| Python environment | uv |
| Deployment | GitHub Pages |

Python is used only for data acquisition and preprocessing.

The deployed application itself is static:

```text
HTML + CSS + JavaScript + JSON
```

No backend server or database is required.

---

## Local Development

### Requirements

- [uv](https://docs.astral.sh/uv/)
- A modern web browser

### 1. Install dependencies

```powershell
uv sync
```

### 2. Build roster data

Roster data normally only needs to be rebuilt when team composition data changes:

```powershell
uv run python .\scripts\build_rosters.py open
uv run python .\scripts\build_rosters.py women
```

### 3. Build tournament data

Use the pairing / result workflow described above, then rebuild the combined dataset with:

```powershell
uv run python .\scripts\build_olympiad.py open
uv run python .\scripts\build_olympiad.py women
```

### 4. Start a local web server

```powershell
uv run python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

---

## Data Source

Tournament information is collected from:

**[Chess-Results](https://chess-results.com/)**

The pipeline uses:

- starting rank
- ranking after each completed round
- team pairings
- team scores
- team rosters
- board pairings and board results
- tournament-local team IDs

Raw downloaded HTML is stored under:

```text
data/raw/
```

and is excluded from Git.

The public web application reads only normalized processed JSON.

---

## Project Status

The core development of **Chess Olympiad Flow** is complete.

The project currently includes:

```text
2026 Chess Olympiad
├─ Open
└─ Women
   ↓
ranking-flow visualization
match pairing / result lifecycle
team rosters
board results
localized UI
light / dark themes
GitHub Pages deployment
```

The 2026 Chess Olympiad is still in progress, so the remaining work is limited to **operational data updates** as new pairings and round results become available.

No fully automated real-time updater is planned for the remaining tournament period.

---

<div align="center">

Built as a data-visualization project for exploring the 2026 Chess Olympiad.

</div>
