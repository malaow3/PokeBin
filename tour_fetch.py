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
    logging.info(f"Found {len(past_rows)} past events")

    return 0


if __name__ == "__main__":
    sys.exit(main())
