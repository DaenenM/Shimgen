"""Test helpers for reporting results through the API, the way the client does."""

from tournaments.models import Match


def _batch(client, match_id, operation):
    tournament_id = Match.objects.values_list("tournament_id", flat=True).get(pk=match_id)
    return client.post(
        f"/api/v1/tournaments/{tournament_id}/batch-report/",
        {"operations": [{"match": match_id, **operation}]},
        format="json",
    )


def post_result(client, match_id, scores):
    """Report one match (`scores` is {"score_a", "score_b"}) via batch-report."""
    return _batch(client, match_id, {"op": "report", **scores})


def post_clear(client, match_id):
    """Clear one match's result via batch-report."""
    return _batch(client, match_id, {"op": "clear"})


def match_in(response, match_id):
    """The match with this id from a batch-report response (the whole tournament)."""
    return next(m for m in response.json()["matches"] if m["id"] == match_id)
