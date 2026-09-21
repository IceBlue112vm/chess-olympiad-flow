import argparse
import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from tournaments import TOURNAMENTS

ROOT = Path(__file__).resolve().parent.parent


def get_data_dirs(event: str) -> tuple[Path, Path]:
    raw_dir = ROOT / "data" / "raw" / event
    processed_dir = ROOT / "data" / "processed" / event

    return raw_dir, processed_dir


def download_starting_rank(
    tournament_id: int,
    output_path: Path,
) -> None:
    base_url = f"https://chess-results.com/tnr{tournament_id}.aspx"

    response = requests.get(
        base_url,
        params={
            "lan": 1,
            "art": 32,
            "zeilen": 99999,
        },
        timeout=30,
    )

    response.raise_for_status()
    output_path.write_bytes(response.content)


def parse_starting_rank(path: Path) -> dict[int, dict]:
    soup = BeautifulSoup(
        path.read_bytes(),
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
            "players": [],
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


def load_upcoming_round(
    processed_dir: Path,
    event: str,
    tournament_id: int,
    teams: dict[int, dict],
    completed_rounds: list[int],
) -> dict | None:
    latest_completed_round = completed_rounds[-1]

    if latest_completed_round >= 11:
        return None

    round_number = latest_completed_round + 1
    path = processed_dir / f"pairings{round_number}.json"

    if not path.exists():
        return None

    data = json.loads(
        path.read_text(
            encoding="utf-8",
        )
    )

    if data.get("event") != event:
        raise RuntimeError(
            f"Pairing event mismatch: "
            f"expected={event!r}, "
            f"actual={data.get('event')!r}"
        )

    if data.get("tournamentId") != tournament_id:
        raise RuntimeError(
            f"Pairing tournament mismatch: "
            f"expected={tournament_id}, "
            f"actual={data.get('tournamentId')}"
        )

    if data.get("round") != round_number:
        raise RuntimeError(
            f"Pairing round mismatch: "
            f"expected={round_number}, "
            f"actual={data.get('round')}"
        )

    records = data.get("pairings")

    if not isinstance(records, list):
        raise RuntimeError(
            f"Invalid pairing data: {path}"
        )

    pairings = {}

    for record in records:
        team_id = record["id"]
        opponent_id = record["opponentId"]
        status = record["status"]

        if team_id in pairings:
            raise RuntimeError(
                f"Duplicate pairing team ID: {team_id}"
            )

        if team_id not in teams:
            raise RuntimeError(
                f"Pairing team {team_id} not found "
                f"in starting rank."
            )

        if status not in {
            "scheduled",
            "bye",
            "notPaired",
        }:
            raise RuntimeError(
                f"Invalid pairing status for "
                f"team {team_id}: {status!r}"
            )

        if status == "scheduled":
            if opponent_id is None:
                raise RuntimeError(
                    f"Scheduled team {team_id} "
                    f"has no opponent."
                )

            if opponent_id not in teams:
                raise RuntimeError(
                    f"Opponent {opponent_id} for "
                    f"team {team_id} not found."
                )
        elif opponent_id is not None:
            raise RuntimeError(
                f"Special pairing for team "
                f"{team_id} unexpectedly has "
                f"opponent {opponent_id}."
            )

        pairings[team_id] = {
            "id": team_id,
            "opponentId": opponent_id,
            "status": status,
        }

    missing_ids = set(teams) - set(pairings)

    if missing_ids:
        raise RuntimeError(
            f"Missing pairing team IDs: "
            f"{sorted(missing_ids)}"
        )

    for team_id, pairing in pairings.items():
        if pairing["status"] != "scheduled":
            continue

        opponent_id = pairing["opponentId"]
        reciprocal = pairings[opponent_id]

        if (
            reciprocal["status"] != "scheduled"
            or reciprocal["opponentId"] != team_id
        ):
            raise RuntimeError(
                f"Non-reciprocal pairing: "
                f"{team_id} -> {opponent_id}"
            )

    return {
        "round": round_number,
        "pairings": sorted(
            pairings.values(),
            key=lambda item: item["id"],
        ),
    }


def load_rosters(
    path: Path,
    event: str,
    teams: dict[int, dict],
) -> dict[int, list[dict]]:
    if not path.exists():
        raise RuntimeError(
            f"Roster data not found: {path}\n"
            f"Run: uv run python .\\scripts\\build_rosters.py {event}"
        )

    data = json.loads(
        path.read_text(
            encoding="utf-8",
        )
    )

    if data.get("event") != event:
        raise RuntimeError(
            f"Roster event mismatch: "
            f"expected={event!r}, "
            f"actual={data.get('event')!r}"
        )

    rosters = {}

    for record in data.get("teams", []):
        team_id = record["id"]

        if team_id in rosters:
            raise RuntimeError(
                f"Duplicate team ID in roster data: {team_id}"
            )

        if team_id not in teams:
            raise RuntimeError(
                f"Roster team {team_id} not found "
                f"in starting rank."
            )

        team = teams[team_id]

        if team["name"] != record["name"]:
            raise RuntimeError(
                f"Roster team identity changed for ID {team_id}: "
                f"{team['name']} -> {record['name']}"
            )

        players = record["players"]

        if not players:
            raise RuntimeError(
                f"No roster players for team "
                f"{team_id}: {team['name']}"
            )

        rosters[team_id] = players

    missing_ids = set(teams) - set(rosters)
    extra_ids = set(rosters) - set(teams)

    if missing_ids:
        raise RuntimeError(
            f"Missing roster team IDs: "
            f"{sorted(missing_ids)}"
        )

    if extra_ids:
        raise RuntimeError(
            f"Unknown roster team IDs: "
            f"{sorted(extra_ids)}"
        )

    return rosters


def build_olympiad(
    event: str,
    tournament_id: int,
    raw_dir: Path,
    processed_dir: Path,
) -> dict:
    starting_rank_path = raw_dir / "starting-rank.html"

    raw_dir.mkdir(parents=True, exist_ok=True)

    download_starting_rank(
        tournament_id,
        starting_rank_path,
    )

    teams = parse_starting_rank(starting_rank_path)

    rosters = load_rosters(
        processed_dir / "rosters.json",
        event,
        teams,
    )

    for team_id, team in teams.items():
        team["players"] = rosters[team_id]

    round_paths = sorted(
        processed_dir.glob("round*.json"),
        key=get_round_number,
    )

    if not round_paths:
        raise RuntimeError("No round JSON files found.")

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

            team["rounds"].append(
                {
                    "round": record["round"],
                    "rank": record["rank"],
                    "opponentId": record["opponentId"],
                    "scoreFor": record["scoreFor"],
                    "scoreAgainst": record["scoreAgainst"],
                    "result": record["result"],
                    "status": record["status"],
                    "boards": record["boards"],
                }
            )

    upcoming_round = load_upcoming_round(
        processed_dir,
        event,
        tournament_id,
        teams,
        round_numbers,
    )

    return {
        "event": event,
        "tournamentId": tournament_id,
        "rounds": round_numbers,
        "upcomingRound": upcoming_round,
        "teams": sorted(
            teams.values(),
            key=lambda team: team["id"],
        ),
    }


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "event",
        choices=TOURNAMENTS.keys(),
        help="Tournament event to build",
    )

    args = parser.parse_args()

    tournament = TOURNAMENTS[args.event]

    raw_dir, processed_dir = get_data_dirs(args.event)

    data = build_olympiad(
        args.event,
        tournament["id"],
        raw_dir,
        processed_dir,
    )

    output_path = processed_dir / "olympiad.json"

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
