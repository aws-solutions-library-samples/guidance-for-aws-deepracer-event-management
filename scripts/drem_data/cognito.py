"""
Cognito user export and import helpers.
"""
import secrets
import string

import boto3


def export_users(user_pool_id: str, region: str) -> list[dict]:
    """
    Export all users from a Cognito User Pool with their group memberships.

    Returns list of:
        {"username": str, "sub": str, "email": str, "countryCode": str,
         "enabled": bool, "status": str, "created": str, "groups": [str]}
    """
    client = boto3.client("cognito-idp", region_name=region)
    users = []

    paginator = client.get_paginator("list_users")
    for page in paginator.paginate(UserPoolId=user_pool_id):
        for user in page["Users"]:
            attrs = {a["Name"]: a["Value"] for a in user.get("Attributes", [])}
            user_record = {
                "username": user["Username"],
                "sub": attrs.get("sub", ""),
                "email": attrs.get("email", ""),
                "countryCode": attrs.get("custom:countryCode", ""),
                "enabled": user.get("Enabled", True),
                "status": user.get("UserStatus", ""),
                "created": user.get("UserCreateDate", "").isoformat()
                if hasattr(user.get("UserCreateDate", ""), "isoformat")
                else str(user.get("UserCreateDate", "")),
            }

            try:
                groups_resp = client.admin_list_groups_for_user(
                    Username=user["Username"],
                    UserPoolId=user_pool_id,
                )
                user_record["groups"] = [g["GroupName"] for g in groups_resp["Groups"]]
            except Exception:
                user_record["groups"] = []

            users.append(user_record)

    return users


def import_users(
    users: list[dict],
    user_pool_id: str,
    region: str,
    dry_run: bool = False,
) -> dict:
    """
    Import users into a Cognito User Pool.

    Creates users with FORCE_CHANGE_PASSWORD, assigns groups, builds sub mapping.

    Returns:
        {"old_sub": "new_sub", ...} mapping dict.
    """
    client = boto3.client("cognito-idp", region_name=region)
    mapping = {}

    for user in users:
        username = user["username"]
        old_sub = user["sub"]

        if dry_run:
            print(f"  [DRY] CREATE user={username} groups={user.get('groups', [])}")
            continue

        user_attrs = []
        if user.get("email"):
            user_attrs.append({"Name": "email", "Value": user["email"]})
            user_attrs.append({"Name": "email_verified", "Value": "true"})
        if user.get("countryCode"):
            user_attrs.append({"Name": "custom:countryCode", "Value": user["countryCode"]})

        temp_password = _generate_temp_password()

        try:
            response = client.admin_create_user(
                UserPoolId=user_pool_id,
                Username=username,
                TemporaryPassword=temp_password,
                UserAttributes=user_attrs,
                MessageAction="SUPPRESS",
            )
            new_sub = ""
            for attr in response["User"].get("Attributes", []):
                if attr["Name"] == "sub":
                    new_sub = attr["Value"]
                    break
            mapping[old_sub] = new_sub
            print(f"  Created user: {username} (sub: {old_sub[:8]}... → {new_sub[:8]}...)")
        except client.exceptions.UsernameExistsException:
            new_sub = _get_sub_for_username(client, user_pool_id, username)
            mapping[old_sub] = new_sub
            print(f"  Exists:       {username} (sub: {old_sub[:8]}... → {new_sub[:8]}...)")
        except Exception as e:
            print(f"  ERROR creating {username}: {e}")
            continue

        for group in user.get("groups", []):
            try:
                client.admin_add_user_to_group(
                    UserPoolId=user_pool_id,
                    Username=username,
                    GroupName=group,
                )
            except Exception as e:
                print(f"  WARNING: Could not add {username} to group {group}: {e}")

    return mapping


def _get_sub_for_username(client, user_pool_id: str, username: str) -> str:
    """Look up the sub for an existing user."""
    try:
        response = client.admin_get_user(
            UserPoolId=user_pool_id,
            Username=username,
        )
        for attr in response.get("UserAttributes", []):
            if attr["Name"] == "sub":
                return attr["Value"]
    except Exception:
        pass
    return ""


def _generate_temp_password(length: int = 16) -> str:
    """Generate a random password meeting Cognito requirements."""
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    password = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*"),
    ]
    password.extend(secrets.choice(chars) for _ in range(length - 4))
    shuffled = list(password)
    secrets.SystemRandom().shuffle(shuffled)
    return "".join(shuffled)
