"""Game list and typed-name resolution for the new tournament form."""

import pytest
from django.urls import reverse

from groups.models import Game
from groups.services.games import normalize, resolve_game

pytestmark = pytest.mark.django_db


def create(client, **extra):
    payload = {"format": "single", "entrant_labels": ["Ann", "Bo"], **extra}
    return client.post(reverse("v1:tournaments:tournament-list"), payload, format="json")


def test_normalize_ignores_case_spacing_and_punctuation():
    assert normalize("CS:GO") == normalize("cs go") == "csgo"


@pytest.mark.parametrize(
    ("typed", "expected"),
    [("LoL", "League of Legends"), ("league", "League of Legends"), ("cs2", "Counter-Strike 2")],
)
def test_nicknames_resolve_to_the_preset(typed, expected):
    game = resolve_game(typed)
    assert game.name == expected
    assert game.is_preset


def test_unknown_game_is_created_once_and_kept_off_the_preset_list():
    first = resolve_game("Blarg Ball")
    assert resolve_game("  blarg   ball ") == first
    assert not first.is_preset


def test_blank_name_means_no_game():
    assert resolve_game("   ") is None


def test_game_list_is_public_and_presets_only(api_client):
    Game.objects.create(name="Someone's Secret Game")
    response = api_client.get(reverse("v1:groups:game-list"))

    assert response.status_code == 200
    names = [g["name"] for g in response.json()]
    assert "League of Legends" in names
    assert "Someone's Secret Game" not in names


def test_create_with_a_nickname_saves_the_preset(api_client):
    response = create(api_client, game_name="lol")

    assert response.status_code == 201
    assert response.json()["game_name"] == "League of Legends"


def test_create_without_a_game_leaves_it_empty(api_client):
    response = create(api_client)

    assert response.status_code == 201
    assert response.json()["game_name"] is None
