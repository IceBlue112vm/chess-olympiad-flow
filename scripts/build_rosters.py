import argparse
import json
from pathlib import Path

from bs4 import BeautifulSoup
import requests

from build_olympiad import (
    download_starting_rank,
    parse_starting_rank,
)
from tournaments import TOURNAMENTS

ROOT = Path(__file__).resolve().parent.parent


def get_paths(event: str) -> tuple[Path, Path]:
    raw_dir = ROOT / "data" / "raw" / event
    processed_dir = ROOT / "data" / "processed" / event

    return raw_dir, processed_dir


def download_team_composition(
    session: requests.Session,
    tournament_id: int,
    team_id: int,
    output_path: Path,
) -> None:
    url = f"https://chess-results.com/tnr{tournament_id}.aspx"

    response = session.get(
        url,
        params={
            "lan": 1,
            "art": 8,
            "snr": team_id,
        },
        timeout=30,
    )

    response.raise_for_status()
    output_path.write_bytes(response.content)


def parse_team_composition(path: Path) -> list[dict]:
    soup = BeautifulSoup(
        path.read_bytes(),
        "html.parser",
    )

    heading = soup.find(
        "h2",
        string=lambda text:
            text
            and "Team-Composition without round-results"
            in text,
    )

    if heading is None:
        raise RuntimeError(
            f"Team-composition heading not found: {path}"
        )

    table = heading.find_next(
        "table",
        class_="CRs1",
    )

    if table is None:
        raise RuntimeError(
            f"Team-composition table not found: {path}"
        )

    players = []

    for row in table.find_all("tr"):
        cells = row.find_all(
            ["th", "td"],
            recursive=False,
        )

        if len(cells) != 10:
            continue

        order_text = cells[0].get_text(
            " ",
            strip=True,
        )

        if not order_text.isdigit():
            continue

        rating_text = cells[3].get_text(
            " ",
            strip=True,
        )

        if not rating_text.isdigit():
            raise RuntimeError(
                f"Invalid player rating "
                f"{rating_text!r}: {path}"
            )

        players.append(
            {
                "order": int(order_text),
                "title": cells[1].get_text(
                    " ",
                    strip=True,
                ),
                "name": cells[2].get_text(
                    " ",
                    strip=True,
                ),
                "rating": int(rating_text),
            }
        )

    if not players:
        raise RuntimeError(
            f"No players found: {path}"
        )

    orders = [
        player["order"]
        for player in players
    ]

    if len(orders) != len(set(orders)):
        raise RuntimeError(
            f"Duplicate board order: {path}"
        )

    return players


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "event",
        choices=TOURNAMENTS.keys(),
        help="Tournament event to build",
    )

    args = parser.parse_args()

    tournament = TOURNAMENTS[args.event]
    raw_dir, processed_dir = get_paths(
        args.event
    )

    raw_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    processed_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    starting_rank_path = (
        raw_dir / "starting-rank.html"
    )

    download_starting_rank(
        tournament["id"],
        starting_rank_path,
    )

    teams = parse_starting_rank(
        starting_rank_path
    )

    rosters = []

    with requests.Session() as session:
        for index, team in enumerate(
            teams.values(),
            start=1,
        ):
            team_id = team["id"]

            raw_path = (
                raw_dir
                / f"team-composition-{team_id}.html"
            )

            download_team_composition(
                session,
                tournament["id"],
                team_id,
                raw_path,
            )

            players = parse_team_composition(
                raw_path
            )

            rosters.append(
                {
                    "id": team_id,
                    "name": team["name"],
                    "players": players,
                }
            )

            print(
                f"[{index}/{len(teams)}] "
                f"{team['name']}: "
                f"{len(players)} players"
            )

    output = {
        "event": args.event,
        "teams": rosters,
    }

    rosters_path = (
        processed_dir / "rosters.json"
    )

    rosters_path.write_text(
        json.dumps(
            output,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    player_counts = {}

    for team in rosters:
        count = len(team["players"])
        player_counts[count] = (
            player_counts.get(count, 0) + 1
        )

    print()
    print(
        f"Wrote {len(rosters)} team rosters "
        f"to {rosters_path}"
    )
    print(
        "Player-count distribution:",
        dict(
            sorted(
                player_counts.items()
            )
        ),
    )


if __name__ == "__main__":
    main()
