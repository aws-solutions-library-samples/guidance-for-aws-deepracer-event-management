"""Shared Cognito user helpers used across multiple Lambda functions."""


def resolve_display_name(user: dict) -> str:
    """Resolve a Cognito user dict to its display name.

    Priority: custom:racerName → preferred_username → Username

    Works with any dict that has an ``Attributes`` list of
    ``{"Name": str, "Value": str}`` items, as returned by
    ``list_users`` / ``admin_get_user``.
    """
    attrs = {a["Name"]: a["Value"] for a in user.get("Attributes", [])}
    return (
        attrs.get("custom:racerName")
        or attrs.get("preferred_username")
        or user["Username"]
    )
