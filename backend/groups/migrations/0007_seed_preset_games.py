"""Seeds the preset game list the new tournament form suggests from."""

from django.db import migrations
from django.utils.text import slugify

# (name, nicknames). Nicknames match ignoring case, spaces and punctuation.
PRESETS = [
    # Video games
    ("League of Legends", ["lol", "league"]),
    ("Valorant", ["val", "valo"]),
    ("Counter-Strike 2", ["cs", "cs2", "csgo", "counter strike"]),
    ("Dota 2", ["dota"]),
    ("Overwatch 2", ["ow", "ow2", "overwatch"]),
    ("Rocket League", ["rl"]),
    ("Fortnite", ["fn"]),
    ("Apex Legends", ["apex"]),
    ("Call of Duty", ["cod", "warzone"]),
    ("Rainbow Six Siege", ["r6", "siege", "rainbow six"]),
    ("Marvel Rivals", ["rivals"]),
    ("Halo Infinite", ["halo"]),
    ("Super Smash Bros. Ultimate", ["smash", "ssbu", "smash bros"]),
    ("Mario Kart 8 Deluxe", ["mk", "mk8", "mario kart"]),
    ("Mario Party", ["mp"]),
    ("Street Fighter 6", ["sf", "sf6", "street fighter"]),
    ("Tekken 8", ["tekken"]),
    ("Mortal Kombat 1", ["mk1", "mortal kombat"]),
    ("EA Sports FC", ["fifa", "fc", "ea fc"]),
    ("NBA 2K", ["2k", "nba"]),
    ("Madden NFL", ["madden"]),
    ("Teamfight Tactics", ["tft"]),
    ("Hearthstone", ["hs"]),
    ("Clash Royale", ["cr"]),
    ("Brawl Stars", []),
    ("Brawlhalla", []),
    ("Minecraft", ["mc"]),
    ("Fall Guys", []),
    ("Among Us", []),
    ("Pummel Party", ["pummel"]),
    ("Gang Beasts", []),
    ("Jackbox Party Pack", ["jackbox"]),
    ("Golf With Your Friends", ["gwyf"]),
    ("Splatoon 3", ["splatoon"]),
    ("Wii Sports", ["wii"]),
    ("Tetris", []),
    # Party and bar games
    ("Beer Pong", ["beerpong", "pong"]),
    ("Flip Cup", ["flipcup"]),
    ("Rage Cage", []),
    ("Kings Cup", ["kings"]),
    ("Cornhole", ["bags", "bean bag toss"]),
    ("Darts", []),
    ("Pool", ["billiards", "8 ball", "eight ball"]),
    ("Ping Pong", ["table tennis"]),
    ("Foosball", ["table football"]),
    ("Air Hockey", []),
    ("Shuffleboard", []),
    ("Bowling", []),
    ("Mini Golf", ["putt putt"]),
    ("Jenga", ["giant jenga"]),
    ("Spikeball", ["roundnet"]),
    ("Axe Throwing", []),
    ("Arm Wrestling", []),
    ("Rock Paper Scissors", ["rps"]),
    # Board and card games
    ("Chess", []),
    ("Checkers", []),
    ("Connect Four", ["connect 4"]),
    ("Poker", ["texas holdem", "holdem"]),
    ("Blackjack", ["21"]),
    ("Uno", []),
    ("Euchre", []),
    ("Cribbage", []),
    ("Crokinole", []),
    ("Catan", ["settlers of catan"]),
    ("Codenames", []),
    ("Scrabble", []),
    ("Monopoly", []),
    # Sports
    ("Basketball", ["bball"]),
    ("Soccer", []),
    ("Volleyball", ["vball"]),
    ("Pickleball", []),
    ("Badminton", []),
    ("Tennis", []),
    ("Golf", []),
]


def seed(apps, schema_editor):
    Game = apps.get_model("groups", "Game")
    for name, aliases in PRESETS:
        Game.objects.update_or_create(
            name=name,
            is_preset=True,
            defaults={"aliases": aliases, "slug": slugify(name)},
        )


def unseed(apps, schema_editor):
    apps.get_model("groups", "Game").objects.filter(is_preset=True).delete()


class Migration(migrations.Migration):
    dependencies = [("groups", "0006_game_aliases_game_is_preset")]

    operations = [migrations.RunPython(seed, unseed)]
