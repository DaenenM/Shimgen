"""
Who may read and who may write a stats board.

Two levels, deliberately. The owner keeps the board's *shape* — its tables,
columns and who else is let in — because those are the things that, changed
carelessly, damage history everyone shares. Editors get the thing they actually
need on a Saturday: add a mark, link a tournament. Everyone else may look.
"""

from rest_framework import permissions


class BoardPermission(permissions.BasePermission):
    """
    Read for anyone holding the link, write for the owner and its editors.

    Reads are open for the same reason spectator brackets are (plan §4, NEW 2):
    the board is something a crew pastes into a group chat, and requiring an
    account to *look* would kill that. The slug is unguessable, so an unlisted
    board stays unlisted.
    """

    def has_object_permission(self, request, view, obj):
        board = _board_of(obj)
        if board is None:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return board.may_edit(request.user)


class IsBoardOwner(permissions.BasePermission):
    """
    Structural changes and access control: the owner alone.

    An editor who could hand out access could hand it to anyone, which makes the
    owner's control over the board nominal.
    """

    message = "Only the board's owner can change this."

    def has_object_permission(self, request, view, obj):
        board = _board_of(obj)
        if board is None:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return board.role_for(request.user) == "owner"


def _board_of(obj):
    """Find the board an object belongs to, wherever it sits in the tree."""
    for path in (
        (),  # the board itself
        ("board",),
        ("table", "board"),
        ("column", "table", "board"),
        ("row", "table", "board"),
    ):
        current = obj
        for attr in path:
            current = getattr(current, attr, None)
            if current is None:
                break
        else:
            if hasattr(current, "role_for"):
                return current

    return None
