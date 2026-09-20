import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"

TOURNAMENT_ID = 1469895
BASE_URL = f"https://chess-results.com/tnr{TOURNAMENT_ID}.aspx"
STARTING_RANK_PATH = RAW_DIR / "starting-rank.html"


def download_starting_rank() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    response = requests.get(
        BASE_URL,
        params={
            "lan": 1,
            "art": 32,
            "zeilen": 99999,
        },
        timeout=30,
    )

    response.raise_for_status()
    STARTING_RANK_PATH.write_bytes(response.content)


def parse_starting_rank() -> dict[int, dict]:
    soup = BeautifulSoup(
        STARTING_RANK_PATH.read_bytes(),
        "html.parser",
    )

    table = soup.find("table", class_="CRs1")

    if table is None:
        raise RuntimeError("Starting rank table not found.")

    teams = {}

    for row in table.find_all("tr"):
        cells = row.find_all("td")

        if len(cells) != 7:
            continue

        start_rank = int(cells[0].get_text(strip=True))
        federation = cells[2].get_text(strip=True)
        name = cells[3].get_text(" ", strip=True)

        team_id = start_rank

        if team_id in teams:
            raise RuntimeError(
                f"Duplicate team ID in starting rank: {team_id}"
            )

        teams[team_id] = {
            "id": team_id,
            "name": name,
            "federation": federation,
            "startRank": start_rank,
            "rounds": [],
        }

    if not teams:
        raise RuntimeError("No teams found in starting rank.")

    return teams


def get_round_number(path: Path) -> int:
    match = re.fullmatch(r"round(\d+)\.json", path.name)

    if match is None:
        raise ValueError(f"Invalid round filename: {path.name}")

    return int(match.group(1))


def load_round(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_olympiad() -> dict:
    round_paths = sorted(
        PROCESSED_DIR.glob("round*.json"),
        key=get_round_number,
    )

    if not round_paths:
        raise RuntimeError("No round JSON files found.")

    download_starting_rank()
    teams = parse_starting_rank()

    round_numbers = []

    for path in round_paths:
        round_number = get_round_number(path)
        round_numbers.append(round_number)

        round_data = load_round(path)

        seen_team_ids = set()

        for record in round_data:
            team_id = record["id"]

            if team_id in seen_team_ids:
                raise RuntimeError(
                    f"Duplicate team ID {team_id} in round {round_number}"
                )

            seen_team_ids.add(team_id)

            if record["round"] != round_number:
                raise RuntimeError(
                    f"Round mismatch for team {team_id}: "
                    f"file={round_number}, data={record['round']}"
                )

            if team_id not in teams:
                raise RuntimeError(
                    f"Team {team_id} appears in round {round_number} "
                    f"but not in starting rank."
                )

            team = teams[team_id]

            if (
                team["name"] != record["name"]
                or team["federation"] != record["federation"]
            ):
                raise RuntimeError(
                    f"Team identity changed for ID {team_id}: "
                    f"{team['name']} / {team['federation']} -> "
                    f"{record['name']} / {record['federation']}"
                )

            teams[team_id]["rounds"].append(
                {
                    "round": record["round"],
                    "rank": record["rank"],
                    "opponentId": record["opponentId"],
                    "scoreFor": record["scoreFor"],
                    "scoreAgainst": record["scoreAgainst"],
                    "result": record["result"],
                    "status": record["status"],
                }
            )

    return {
        "tournamentId": TOURNAMENT_ID,
        "rounds": round_numbers,
        "teams": sorted(
            teams.values(),
            key=lambda team: team["id"],
        ),
    }


def main():
    data = build_olympiad()

    output_path = PROCESSED_DIR / "olympiad.json"

    output_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"Wrote {len(data['teams'])} teams across "
        f"{len(data['rounds'])} rounds to {output_path}"
    )


if __name__ == "__main__":
    main()