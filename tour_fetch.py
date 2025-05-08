from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field

import mlogger
import requests
from bs4 import BeautifulSoup, Tag

logging = mlogger.init_logger()


def normalize_name(name: str) -> str:
    # Remove leading/trailing whitespace and collapse multiple spaces
    return " ".join(name.strip().split())


@dataclass
class Link:
    href: str
    name: str


@dataclass
class Tournament:
    dates: str
    name: str
    location: str
    links: list[Link]


@dataclass
class Match:
    p1: str
    p2: str
    p1_win: bool
    p2_win: bool
    p1_score: int
    p2_score: int
    p1_record: str
    p2_record: str
    p1_drop: bool
    p2_drop: bool


MIN_YEAR = 2025


@dataclass
class Standing:
    name: str
    country: str
    paste: str
    opponents: list[str] = field(default_factory=list)
    results_vs: list[str] = field(default_factory=list)
    wins: int = 0
    losses: int = 0
    ties: int = 0
    points: int = 0
    dropped: int = -1
    win_perc: float = 0.25
    opp_win_perc: float = 0.25
    opp_opp_win_perc: float = 0.25


def standing_to_dict(standing, placement):
    return {
        "name": standing.name,
        "placement": placement,
        "country": standing.country,
        "paste": standing.paste,
        "wins": standing.wins,
        "losses": standing.losses,
        "ties": standing.ties,
        "points": standing.points,
        "win_perc": round(standing.win_perc, 4),
        "opp_win_perc": round(standing.opp_win_perc, 4),
        "opp_opp_win_perc": round(standing.opp_opp_win_perc, 4),
        "dropped": standing.dropped,
        "opponents": standing.opponents,
        "results_vs": standing.results_vs,
    }


def row_to_tournament(row: Tag) -> Tournament:
    cols = row.select("td")
    date = cols[0].getText()
    a_tag = cols[2].select_one("a")
    if not a_tag:
        name = cols[2].getText()
    else:
        name = a_tag.getText()
    location = cols[3].getText()
    links = cols[4]
    links_tags = links.select("a")
    links_list: list[Link] = []
    for link in links_tags:
        href = link.get("href")
        assert href is not None
        links_list.append(Link(href=str(href), name=link.getText()))
    return Tournament(dates=date, name=name, location=location, links=links_list)


def filter_years(t: Tournament) -> bool:
    items = t.dates.split(", ")
    year = items[1]
    year_num = int(year)
    if year_num < MIN_YEAR:
        name_items = t.name.split(" ")
        name_year = name_items[-1]
        try:
            name_year_num = int(name_year)
            if name_year_num >= MIN_YEAR:
                return True
        except ValueError:
            return False
        return False
    return True


def parse_row(row: Tag) -> Match:
    items = row.select("div")
    p1_div = items[0]
    p2_div = items[2]
    p1_class_list = p1_div.attrs["class"]
    p2_class_list = p2_div.attrs["class"]

    p1_win = "winner" in p1_class_list
    p2_win = "winner" in p2_class_list
    p1_dropped = "dropped" in p1_class_list
    p2_dropped = "dropped" in p2_class_list

    p1_span = p1_div.select_one("span")
    assert p1_span is not None
    p1_name = p1_span.getText()
    p1_record_score = p1_span.next_sibling
    assert p1_record_score is not None
    p1_record_score_text = p1_record_score.getText().strip()
    p1_record_score_items = p1_record_score_text.split(" ")
    p1_record = p1_record_score_items[0]
    if len(p1_record_score_items) > 1:
        p1_score = int(p1_record_score_items[1])
    else:
        p1_score = 0

    p2_span = p2_div.select_one("span")
    if p2_span is None:
        p2_name = ""
        p2_record = ""
        p2_score = 0
    else:
        p2_name = p2_span.getText()
        p2_record_score = p2_span.next_sibling
        assert p2_record_score is not None
        p2_record_score_text = p2_record_score.getText().strip()
        p2_record_score_items = p2_record_score_text.split(" ")
        p2_record = p2_record_score_items[0]
        if len(p2_record_score_items) > 1:
            p2_score = int(p2_record_score_items[1])
        else:
            p2_score = 0

    return Match(
        p1=p1_name,
        p2=p2_name,
        p1_win=p1_win,
        p2_win=p2_win,
        p1_score=p1_score,
        p2_score=p2_score,
        p1_record=p1_record,
        p2_record=p2_record,
        p1_drop=p1_dropped,
        p2_drop=p2_dropped,
    )


def parse_rounds(t: Tournament):
    logging.info(f"Parsing {t.name}")
    pod = 2
    rnd = 1

    vg_link = None
    for link in t.links:
        if link.name == "VG":
            vg_link = link
            break
    if not vg_link:
        raise ValueError(f"No VG link found for {t.name}")

    id = vg_link.href.split("/")[-1]

    matches: list[list[Match]] = []
    while True:
        local_matches = []
        try:
            pairings_response = requests.get(
                f"https://rk9.gg/pairings/{id}?pod={pod}&rnd={rnd}"
            )
        except Exception:
            break
        if pairings_response.status_code != 200:
            break
        soup = BeautifulSoup(pairings_response.text, "html.parser")
        rows = list(soup.select("div.row"))
        if len(rows) == 0:
            break

        print(f"Parsing round: {rnd}")
        for row in rows:
            local_matches.append(parse_row(row))
        matches.append(local_matches)

        rnd += 1

    return matches


def calculate_resistances(standings: dict[str, Standing]):
    # Win %
    for player in standings.values():
        total = player.wins + player.losses + player.ties
        if total > 0:
            winp = (player.wins + 0.5 * player.ties) / total
            if winp < 0.25:
                winp = 0.25
            player.win_perc = winp
        else:
            player.win_perc = 0.25
    # Opp Win %
    for player in standings.values():
        opps = [o for o in player.opponents if isinstance(o, str) and o in standings]
        if opps:
            opp_winp = sum(standings[o].win_perc for o in opps) / len(opps)
            if opp_winp < 0.25:
                opp_winp = 0.25
            player.opp_win_perc = opp_winp
        else:
            player.opp_win_perc = 0.25
    # Opp Opp Win %
    for player in standings.values():
        opps = [o for o in player.opponents if isinstance(o, str) and o in standings]
        if opps:
            opp_opp_winp = sum(standings[o].opp_win_perc for o in opps) / len(opps)
            if opp_opp_winp < 0.25:
                opp_opp_winp = 0.25
            player.opp_opp_win_perc = opp_opp_winp
        else:
            player.opp_opp_win_perc = 0.25


def process_swiss_rounds(matches, num_rounds):
    standings: dict[str, Standing] = {}
    for rnd_num, rnd in enumerate(matches):
        if (rnd_num + 1) > num_rounds:
            break
        for match in rnd:
            p1 = normalize_name(match.p1)
            p2 = normalize_name(match.p2)
            p1_section = p1.split(" [")
            p1_name = normalize_name(p1_section[0])
            p1_dropped = match.p1_drop
            p2_dropped = match.p2_drop
            try:
                p1_country = p1_section[1].split("]")[0]
            except IndexError:
                p1_country = ""
            if p2 != "":
                p2_section = p2.split(" [")
                p2_name = normalize_name(p2_section[0])
                try:
                    p2_country = p2_section[1].split("]")[0]
                except IndexError:
                    p2_country = ""

                if p1_name not in standings:
                    standings[p1_name] = Standing(
                        name=p1_name,
                        country=p1_country,
                        paste="",
                        wins=0,
                        losses=0,
                        ties=0,
                        points=0,
                        opponents=[],
                        dropped=-1,
                    )
                if p2_name not in standings:
                    standings[p2_name] = Standing(
                        name=p2_name,
                        country=p2_country,
                        paste="",
                        wins=0,
                        losses=0,
                        ties=0,
                        points=0,
                        opponents=[],
                        dropped=-1,
                    )
                p1_standing = standings[p1_name]
                p2_standing = standings[p2_name]
                if p1_dropped:
                    p1_standing.dropped = rnd_num + 1
                if p2_dropped:
                    p2_standing.dropped = rnd_num + 1
                if match.p1_win:
                    p1_standing.wins += 1
                    p1_standing.points += 3
                    p2_standing.losses += 1
                    p1_standing.results_vs.append("W")
                    p2_standing.results_vs.append("L")
                elif match.p2_win:
                    p2_standing.points += 3
                    p1_standing.losses += 1
                    p1_standing.results_vs.append("L")
                    p2_standing.results_vs.append("W")
                else:
                    # tie
                    p1_standing.ties += 1
                    p2_standing.ties += 1
                    p1_standing.points += 1
                    p2_standing.points += 1
                    p1_standing.results_vs.append("T")
                    p2_standing.results_vs.append("T")
                p1_standing.opponents.append(p2_name)
                p2_standing.opponents.append(p1_name)
            else:
                if match.p1_win:
                    if p1_name not in standings:
                        standings[p1_name] = Standing(
                            name=p1_name,
                            country=p1_country,
                            paste="",
                            wins=0,
                            losses=0,
                            ties=0,
                            points=0,
                            opponents=[],
                            dropped=-1,
                        )
                    p1_standing = standings[p1_name]
                    p1_standing.wins += 1
                    p1_standing.points += 3
                    p1_standing.opponents.append("Bye")
                    p1_standing.results_vs.append("W")
                    if p1_dropped:
                        p1_standing.dropped = rnd_num + 1
                else:
                    if p1_name not in standings:
                        standings[p1_name] = Standing(
                            name=p1_name,
                            country=p1_country,
                            paste="",
                            wins=0,
                            losses=0,
                            ties=0,
                            points=0,
                            opponents=[],
                            dropped=-1,
                        )
                    p1_standing = standings[p1_name]
                    p1_standing.losses += 1
                    p1_standing.opponents.append("Missed")
                    p1_standing.results_vs.append("L")
                    if p1_dropped:
                        p1_standing.dropped = rnd_num + 1
    calculate_resistances(standings)
    return standings


def output_standings(standings: dict[str, Standing], filename: str):
    sorted_standings = sorted(
        standings.values(),
        key=lambda s: (
            -s.points,
            -s.win_perc,
            -s.opp_win_perc,
            -s.opp_opp_win_perc,
            s.name.lower(),
        ),
    )
    with open(filename, "w") as f:
        json.dump(
            [
                standing_to_dict(s, placement=i + 1)
                for i, s in enumerate(sorted_standings)
            ],
            f,
            indent=2,
            ensure_ascii=False,
        )


def is_swiss_round(round_matches: list[Match]):
    # If at least one match has a non-empty record, it's a Swiss round
    for match in round_matches:
        if match.p1_score != 0 or match.p2_score != 0:
            return True
    return False


def split_swiss_topcut(matches):
    swiss = []
    topcut = []
    for round_matches in matches:
        if is_swiss_round(round_matches):
            swiss.append(round_matches)
        else:
            topcut.append(round_matches)
    return swiss, topcut


def output_topcut_standings(
    placements, swiss_standings, filename="standings_topcut.json"
):
    # placements: dict[player_name, placement]
    sorted_players = sorted(placements.items(), key=lambda x: x[1])
    with open(filename, "w") as f:
        json.dump(
            [
                standing_to_dict(get_swiss_standing(name, swiss_standings), placement)
                for name, placement in sorted_players
            ],
            f,
            indent=2,
            ensure_ascii=False,
        )


def strip_country(name: str) -> str:
    # Remove country code in brackets, e.g. "Luca Paz [US]" -> "Luca Paz"
    return name.split(" [")[0].strip()


def get_swiss_standing(s: str, swiss_standings: dict) -> Standing:
    if s in swiss_standings:
        return swiss_standings[s]
    s_nocountry = strip_country(s)
    for key in swiss_standings:
        if strip_country(key) == s_nocountry:
            return swiss_standings[key]
    # Optionally, use difflib for fuzzy matching
    import difflib

    close = difflib.get_close_matches(s, swiss_standings.keys(), n=1)
    if close:
        return swiss_standings[close[0]]
    raise KeyError(f"Could not find Swiss standing for: {s}")


def process_topcut_rounds(topcut_rounds, standings):
    def get_name_key(name):
        # Use the same normalization as in process_swiss_rounds
        return normalize_name(name.split(" [")[0])

    for round_matches in topcut_rounds:
        for match in round_matches:
            p1_key = get_name_key(match.p1)
            p2_key = get_name_key(match.p2)
            if not p1_key or not p2_key:
                continue
            if p1_key not in standings or p2_key not in standings:
                continue  # skip if not found in Swiss (shouldn't happen)
            p1_standing = standings[p1_key]
            p2_standing = standings[p2_key]
            # Record result
            if match.p1_win:
                p1_standing.results_vs.append("W")
                p2_standing.results_vs.append("L")
            elif match.p2_win:
                p1_standing.results_vs.append("L")
                p2_standing.results_vs.append("W")
            else:
                p1_standing.results_vs.append("T")
                p2_standing.results_vs.append("T")
            # Add to opponents list if not already present
            if p2_key not in p1_standing.opponents:
                p1_standing.opponents.append(p2_key)
            if p1_key not in p2_standing.opponents:
                p2_standing.opponents.append(p1_key)


def parse_topcut_bracket_with_swiss(topcut_rounds, swiss_standings):
    alive = set()
    placements = {}
    round_losers = []

    # Initialize with all players in the first top cut round
    for match in topcut_rounds[0]:
        if match.p1:
            alive.add(normalize_name(match.p1))
        if match.p2:
            alive.add(normalize_name(match.p2))

    # For each round, record the losers
    for round_matches in topcut_rounds:
        losers = []
        next_alive = set()
        for match in round_matches:
            p1 = normalize_name(match.p1)
            p2 = normalize_name(match.p2)
            if match.p1_win:
                winner, loser = p1, p2
            elif match.p2_win:
                winner, loser = p2, p1
            else:
                continue
            next_alive.add(winner)
            losers.append(loser)
        round_losers.append(losers)
        alive = next_alive

    # The last player alive is the winner
    if alive:
        winner = list(alive)[0]
        placements[winner] = 1

    # The loser of the final is 2nd
    if topcut_rounds and topcut_rounds[-1]:
        final_match = topcut_rounds[-1][0]
        p1 = normalize_name(final_match.p1)
        p2 = normalize_name(final_match.p2)
        if final_match.p1_win:
            runner_up = p2
        else:
            runner_up = p1
        placements[runner_up] = 2

    # Assign the rest: for each round, sort losers by Swiss tiebreakers
    place = 3
    for losers in reversed(round_losers[:-1]):
        group = [
            normalize_name(p)
            for p in losers
            if normalize_name(p) and normalize_name(p) not in placements
        ]
        group_sorted = sorted(
            group,
            key=lambda s: (
                -get_swiss_standing(s, swiss_standings).points,
                -get_swiss_standing(s, swiss_standings).win_perc,
                -get_swiss_standing(s, swiss_standings).opp_win_perc,
                -get_swiss_standing(s, swiss_standings).opp_opp_win_perc,
                s.lower(),
            ),
        )
        for p in group_sorted:
            placements[p] = place
            place += 1

    return placements


def output_combined_standings(
    topcut_placements, swiss_sorted, swiss_standings, filename="standings_combined.json"
):
    # Remove the first X players from Swiss standings (the top cut)
    TOP_CUT_SIZE = len(topcut_placements)
    swiss_only = swiss_sorted[TOP_CUT_SIZE:]

    # Build the combined list
    combined = []
    # Add top cut players with their bracket placements
    for name, placement in topcut_placements:
        combined.append(
            standing_to_dict(get_swiss_standing(name, swiss_standings), placement)
        )
    # Add Swiss-only players, with placements continuing after top cut
    for i, s in enumerate(swiss_only):
        combined.append(standing_to_dict(s, placement=TOP_CUT_SIZE + i + 1))

    with open(filename, "w") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)


def main() -> int:
    r = requests.get("https://rk9.gg/events/pokemon")
    soup = BeautifulSoup(r.text, "html.parser")
    body = soup.find("body")

    if not isinstance(body, Tag):
        print("No <body> tag found!")
        return 1

    upcoming = body.select_one("#dtUpcomingEvents > tbody")
    assert upcoming is not None
    upcoming_rows = list(map(lambda x: row_to_tournament(x), upcoming.select("tr")))
    logging.info(f"Found {len(upcoming_rows)} upcoming events")

    past = body.select_one("#dtPastEvents > tbody")
    assert past is not None
    past_rows = list(map(lambda x: row_to_tournament(x), past.select("tr")))
    past_rows = list(filter(filter_years, past_rows))
    logging.info(f"Found {len(past_rows)} past events")

    most_recent = past_rows[0]

    matches = parse_rounds(most_recent)

    swiss_rounds, topcut_rounds = split_swiss_topcut(matches)

    standings = process_swiss_rounds(swiss_rounds, len(swiss_rounds))
    output_standings(standings, "standings_swiss.json")

    if topcut_rounds:
        process_topcut_rounds(topcut_rounds, standings)
        placements = parse_topcut_bracket_with_swiss(topcut_rounds, standings)
        output_topcut_standings(placements, standings)
    else:
        placements = {}

    swiss_sorted = sorted(
        standings.values(),
        key=lambda s: (
            -s.points,
            -s.win_perc,
            -s.opp_win_perc,
            -s.opp_opp_win_perc,
            s.name.lower(),
        ),
    )
    topcut_placements = sorted(placements.items(), key=lambda x: x[1])
    output_combined_standings(topcut_placements, swiss_sorted, standings)

    return 0


if __name__ == "__main__":
    sys.exit(main())
