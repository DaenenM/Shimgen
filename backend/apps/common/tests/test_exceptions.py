"""The error envelope's message must be readable on its own (config/exceptions.py)."""

from django.http import Http404
from rest_framework import serializers

from config.exceptions import api_exception_handler


def envelope(exc):
    return api_exception_handler(exc, {}).data["error"]


def test_field_error_names_the_field():
    error = envelope(serializers.ValidationError({"display_name": ["This field is required."]}))

    assert error["message"] == "Display name: This field is required."
    assert error["details"] == {"display_name": ["This field is required."]}


def test_non_field_error_is_the_message_as_is():
    error = envelope(serializers.ValidationError({"non_field_errors": ["Teams must differ."]}))

    assert error["message"] == "Teams must differ."


def test_nested_error_is_found():
    exc = serializers.ValidationError({"entrants": [{}, {"name": ["Too long."]}]})

    assert envelope(exc)["message"] == "Entrants: Too long."


def test_django_404_does_not_leak_model_names():
    error = envelope(Http404("No Player matches the given query."))

    assert error["code"] == "not_found"
    assert "Player" not in error["message"]
