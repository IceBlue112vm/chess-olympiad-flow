import argparse
import json
from pathlib import Path

from bs4 import BeautifulSoup
import requests

from tournaments import TOURNAMENTS


ROOT = Path(__file__).resolve().parent.parent


def get_data_dirs(
    event: str,
) -> tuple[Path, Path]:
    raw_dir = (
        ROOT
        / "data"
        / "raw"
        / event
    )

    processed_dir = (
        ROOT
        / "data"
        / "processed"
        / event
    )

    return raw_dir, processed_dir


def download_pairings(
    tournament_id: int,
    round_number: int,
    output_path: Path,
) -> None:
    base_url = (
        f"https://chess-results.com/"
        f"tnr{tournament_id}.aspx"
    )

    response = requests.get(
        base_url,
        params={
            "lan": 1,
            "art": 2,
            "rd": round_number,
            "zeilen": 99999,
        },
        timeout=30,
    )

    response.raise_for_status()

    output_path.write_bytes(
        response.content
    )


def load_soup(
    path: Path,
) -> BeautifulSoup:
    return BeautifulSoup(
        path.read_bytes(),
        "html.parser",
    )


def add_pairing(
    pairings: dict[int, dict],
    team_id: int,
    opponent_id: int | None,
    status: str,
) -> None:
    if team_id in pairings:
        raise RuntimeError(
            f"Duplicate pairing for team "
            f"{team_id}"
        )

    pairings[team_id] = {
        "id": team_id,
        "opponentId": opponent_id,
        "status": status,
    }


def parse_pairings(
    path: Path,
) -> dict[int, dict]:
    soup = load_soup(path)

    heading = soup.find(
        "h2",
        string=lambda text:
            text
            and "Team pairings" in text,
    )

    if heading is None:
        raise RuntimeError(
            f"Pairings heading not found: "
            f"{path}"
        )

    table = heading.find_next(
        "table",
        class_="CRs1",
    )

    if table is None:
        raise RuntimeError(
            f"Pairings table not found: "
            f"{path}"
        )

    pairings = {}

    for row in table.find_all("tr"):
        cells = row.find_all(
            "td",
            recursive=False,
        )

        if len(cells) != 16:
            continue

        left_id_text = (
            cells[1]
            .get_text(strip=True)
        )

        right_team = (
            cells[12]
            .get_text(
                " ",
                strip=True,
            )
        )

        right_id_text = (
            cells[15]
            .get_text(strip=True)
        )

        if not left_id_text.isdigit():
            continue

        left_id = int(
            left_id_text
        )

        special_status = (
            right_team
            .strip()
            .casefold()
        )

        if (
            special_status
            == "not paired"
        ):
            add_pairing(
                pairings,
                left_id,
                None,
                "notPaired",
            )
            continue

        if special_status == "bye":
            add_pairing(
                pairings,
                left_id,
                None,
                "bye",
            )
            continue

        try:
            right_id = int(
                right_id_text
            )
        except ValueError as error:
            raise RuntimeError(
                "Invalid opponent ID: "
                f"team={left_id}, "
                f"opponent={right_team!r}, "
                f"value={right_id_text!r}"
            ) from error

        if right_id <= 0:
            raise RuntimeError(
                "Unknown special pairing: "
                f"team={left_id}, "
                f"opponent={right_team!r}, "
                f"opponentId={right_id}"
            )

        add_pairing(
            pairings,
            left_id,
            right_id,
            "scheduled",
        )

        add_pairing(
            pairings,
            right_id,
            left_id,
            "scheduled",
        )

    if not pairings:
        raise RuntimeError(
            "No pairings were parsed."
        )

    return pairings


def validate_pairings(
    pairings: dict[int, dict],
) -> None:
    for team_id, pairing in (
        pairings.items()
    ):
        opponent_id = (
            pairing["opponentId"]
        )

        if opponent_id is None:
            continue

        if opponent_id not in pairings:
            raise RuntimeError(
                f"Opponent {opponent_id} "
                f"for team {team_id} "
                f"is missing."
            )

        reciprocal = (
            pairings[opponent_id]
        )

        if (
            reciprocal["opponentId"]
            != team_id
        ):
            raise RuntimeError(
                "Non-reciprocal pairing: "
                f"{team_id} -> "
                f"{opponent_id}"
            )


def build_pairings(
    event: str,
    tournament_id: int,
    round_number: int,
    raw_dir: Path,
    processed_dir: Path,
) -> dict:
    raw_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    processed_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    raw_path = (
        raw_dir
        / (
            f"pairings-round"
            f"{round_number}.html"
        )
    )

    download_pairings(
        tournament_id,
        round_number,
        raw_path,
    )

    pairings = parse_pairings(
        raw_path
    )

    validate_pairings(
        pairings
    )

    return {
        "event": event,
        "tournamentId":
            tournament_id,
        "round": round_number,
        "pairings": sorted(
            pairings.values(),
            key=lambda item:
                item["id"],
        ),
    }


def main() -> None:
    parser = (
        argparse.ArgumentParser()
    )

    parser.add_argument(
        "event",
        choices=TOURNAMENTS.keys(),
        help=(
            "Tournament event "
            "to build"
        ),
    )

    parser.add_argument(
        "round",
        type=int,
        help=(
            "Upcoming round "
            "number"
        ),
    )

    args = parser.parse_args()

    if args.round < 1:
        raise ValueError(
            "Round must be at least 1."
        )

    tournament = (
        TOURNAMENTS[
            args.event
        ]
    )

    raw_dir, processed_dir = (
        get_data_dirs(
            args.event
        )
    )

    data = build_pairings(
        args.event,
        tournament["id"],
        args.round,
        raw_dir,
        processed_dir,
    )

    output_path = (
        processed_dir
        / (
            f"pairings"
            f"{args.round}.json"
        )
    )

    output_path.write_text(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    scheduled_count = sum(
        1
        for pairing
        in data["pairings"]
        if pairing["status"]
        == "scheduled"
    )

    match_count = (
        scheduled_count // 2
    )

    special_count = (
        len(data["pairings"])
        - scheduled_count
    )

    print(
        f"Wrote round "
        f"{args.round} pairings "
        f"for {args.event}"
    )

    print(
        f"Teams: "
        f"{len(data['pairings'])}"
    )

    print(
        f"Scheduled matches: "
        f"{match_count}"
    )

    print(
        f"Bye / not paired: "
        f"{special_count}"
    )

    print(
        f"Output: {output_path}"
    )


if __name__ == "__main__":
    main()