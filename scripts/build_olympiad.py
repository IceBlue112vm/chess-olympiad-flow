import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = ROOT / "data" / "processed"

TOURNAMENT_ID = 1469895


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

    teams = {}
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
                teams[team_id] = {
                    "id": team_id,
                    "name": record["name"],
                    "federation": record["federation"],
                    "rounds": [],
                }
            else:
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