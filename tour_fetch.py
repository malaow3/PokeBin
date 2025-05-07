import json
import sys
from dataclasses import dataclass

import mlogger
import requests
from bs4 import BeautifulSoup, Tag

logging = mlogger.init_logger()


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


MIN_YEAR = 2025


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

    p1_span = p1_div.select_one("span")
    assert p1_span is not None
    p1_name = p1_span.getText()
    p1_record_score = p1_span.next_sibling
    assert p1_record_score is not None
    p1_record_score_text = p1_record_score.getText().strip()
    p1_record_score_items = p1_record_score_text.split(" ")
    p1_record = p1_record_score_items[0]
    p1_score = int(p1_record_score_items[1])

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
        p2_score = int(p2_record_score_items[1])

    return Match(
        p1=p1_name,
        p2=p2_name,
        p1_win=p1_win,
        p2_win=p2_win,
        p1_score=p1_score,
        p2_score=p2_score,
        p1_record=p1_record,
        p2_record=p2_record,
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

    pairings_response = requests.get(
        f"https://rk9.gg/pairings/{id}?pod={pod}&rnd={rnd}"
    )
    soup = BeautifulSoup(pairings_response.text, "html.parser")
    rows = list(soup.select("div.row"))

    matches: list[Match] = []
    for row in rows:
        matches.append(parse_row(row))

    matches_list = list(map(lambda x: x.__dict__, matches))
    print(json.dumps(matches_list, indent=4))


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
    parse_rounds(most_recent)

    return 0


if __name__ == "__main__":
    sys.exit(main())
