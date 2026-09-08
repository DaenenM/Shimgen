"""Pagination shared by every list endpoint."""

from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """
    Page-number pagination with a client-controllable size.

    `page_size` is capped so a caller cannot ask for the entire table in one
    request — the roster and match-history endpoints are the ones that would
    otherwise grow without bound.
    """

    page_size_query_param = "page_size"
    max_page_size = 200
