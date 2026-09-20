import argparse
import json
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from tournaments import TOURNAMENTS

ROOT = Path(__file__).resolve().parent.parent


def get_data_dirs(event: str) -> tuple[Path, Path]:
    raw_dir = ROOT / "data" / "raw" / event
    processed_dir = ROOT / "data" / "processed" / event

    return raw_dir, processed_dir


def load_soup(path: Path) -> BeautifulSoup:
    return BeautifulSoup(path.read_bytes(), "html.parser")


def download_page(
    tournament_id: int,
    round_number: int,
    art: int,
    output_path: Path,
) -> None:
    base_url = f"https://chess-results.com/tnr{tournament_id}.aspx"

    response = requests.get(
        base_url,
        params={
            "lan": 1,
            "art": art,
            "rd": round_number,
            "zeilen": 99999,
        },
        timeout=30,
    )

    response.raise_for_status()
    output_path.write_bytes(response.content)


def download_round(
    tournament_id: int,
    round_number: int,
    raw_dir: Path,
) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)

    download_page(
        tournament_id,
        round_number,
        art=0,
        output_path=raw_dir / f"round{round_number}.html",
    )

    download_page(
        tournament_id,
        round_number,
        art=2,
        output_path=raw_dir / f"pairings-round{round_number}.html",
    )


def parse_ranking(path: Path) -> dict[int, dict]:
    soup = load_soup(path)

    heading = soup.find("h2", string=lambda text: text and "Rank after Round" in text)
    if heading is None:
        raise RuntimeError(f"Ranking heading not found: {path}")

    table = heading.find_next("table", class_="CRs1")
    if table is None:
        raise RuntimeError(f"Ranking table not found: {path}")

    teams = {}
    current_rank = None

    for row in table.find_all("tr"):
        cells = row.find_all("td")

        if len(cells) != 14:
            continue

        rank_text = cells[0].get_text(strip=True)

        # Chess-Results leaves tied ranks blank.
        if rank_text:
            current_rank = int(rank_text)

        team_id = int(cells[1].get_text(strip=True))

        if team_id in teams:
            raise RuntimeError(
                f"Duplicate team ID in ranking: {team_id}"
            )

        teams[team_id] = {
            "id": team_id,
            "name": cells[4].get_text(" ", strip=True),
            "federation": cells[2].get_text(strip=True),
            "rank": current_rank,
        }

    return teams


def parse_score(text: str) -> float:
    text = text.strip().replace(",", ".")

    if "½" in text:
        whole = text.replace("½", "")
        return (float(whole) if whole else 0.0) + 0.5

    return float(text)


def result_from_score(score_for: float, score_against: float) -> str:
    if score_for > score_against:
        return "W"

    if score_for < score_against:
        return "L"

    return "D"


def parse_pairings(path: Path) -> dict[int, dict]:
    soup = load_soup(path)

    heading = soup.find("h2", string=lambda text: text and "Team pairings" in text)
    if heading is None:
        raise RuntimeError(f"Pairings heading not found: {path}")

    table = heading.find_next("table", class_="CRs1")
    if table is None:
        raise RuntimeError(f"Pairings table not found: {path}")

    pairings = {}

    for row in table.find_all("tr"):
        cells = row.find_all("td")

        if len(cells) != 16:
            continue

        left_id = int(cells[1].get_text(strip=True))
        right_team = cells[12].get_text(" ", strip=True)
        right_id = int(cells[15].get_text(strip=True))

        left_score_text = cells[7].get_text(strip=True)
        right_score_text = cells[9].get_text(strip=True)

        if right_team == "not paired":
            pairings[left_id] = {
                "opponentId": None,
                "scoreFor": None,
                "scoreAgainst": None,
                "result": None,
                "status": "notPaired",
            }
            continue

        if right_team == "bye":
            left_score = parse_score(left_score_text)
            right_score = parse_score(right_score_text)

            pairings[left_id] = {
                "opponentId": None,
                "scoreFor": left_score,
                "scoreAgainst": right_score,
                "result": result_from_score(left_score, right_score),
                "status": "bye",
            }
            continue

        if right_id < 0:
            raise RuntimeError(
                f"Unknown special pairing in round data: "
                f"team={left_id}, opponent={right_team!r}, opponentId={right_id}"
            )

        left_score = parse_score(left_score_text)
        right_score = parse_score(right_score_text)

        pairings[left_id] = {
            "opponentId": right_id,
            "scoreFor": left_score,
            "scoreAgainst": right_score,
            "result": result_from_score(left_score, right_score),
            "status": "played",
        }

        pairings[right_id] = {
            "opponentId": left_id,
            "scoreFor": right_score,
            "scoreAgainst": left_score,
            "result": result_from_score(right_score, left_score),
            "status": "played",
        }

    return pairings


def build_round(
    round_number: int,
    raw_dir: Path,
) -> list[dict]:
    ranking_path = raw_dir / f"round{round_number}.html"
    pairings_path = raw_dir / f"pairings-round{round_number}.html"

    rankings = parse_ranking(ranking_path)
    pairings = parse_pairings(pairings_path)

    extra_pairing_ids = set(pairings) - set(rankings)

    if extra_pairing_ids:
        print(
            f"Pairing-only team IDs in round {round_number}: "
            f"{sorted(extra_pairing_ids)}"
        )

    result = []

    for team_id, team in rankings.items():
        if team_id not in pairings:
            raise RuntimeError(
                f"No pairing data for team {team_id}: {team['name']}"
            )

        pairing = pairings[team_id]

        result.append(
            {
                **team,
                "round": round_number,
                **pairing,
            }
        )

    return result


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "event",
        choices=TOURNAMENTS.keys(),
        help="Tournament event to build",
    )

    parser.add_argument(
        "round",
        type=int,
        help="Round number to build",
    )

    args = parser.parse_args()

    tournament = TOURNAMENTS[args.event]
    round_number = args.round

    raw_dir, processed_dir = get_data_dirs(args.event)

    download_round(
        tournament["id"],
        round_number,
        raw_dir,
    )

    data = build_round(
        round_number,
        raw_dir,
    )

    processed_dir.mkdir(parents=True, exist_ok=True)

    output_path = processed_dir / f"round{round_number}.json"

    output_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"Wrote {len(data)} teams to {output_path}"
    )


if __name__ == "__main__":
    main()