"""Abstract base models shared across apps."""

from django.db import models


class TimeStampedModel(models.Model):
    """
    Adds created_at / updated_at to a model.

    Nearly every table here wants both — "on this day" history and
    recently-played ordering are built directly on them (plan §4, NEW 9) — so
    they are defined once rather than repeated per model.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
