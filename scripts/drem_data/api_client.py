"""
GraphQL API client for DREM AppSync endpoint.
Used for API-based export when direct DynamoDB access isn't available.
"""
import json

import requests


class DremApiClient:
    """Simple GraphQL client authenticated with a Cognito JWT."""

    def __init__(self, endpoint: str, token: str):
        self.endpoint = endpoint
        self.token = token

    def _gql(self, query: str, variables: dict | None = None) -> dict:
        """Execute a GraphQL query and return the data dict."""
        resp = requests.post(
            self.endpoint,
            json={"query": query, "variables": variables or {}},
            headers={
                "Content-Type": "application/json",
                "Authorization": self.token,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        if "errors" in data:
            raise RuntimeError(f"GraphQL errors: {data['errors']}")
        return data["data"]

    def get_events(self) -> list[dict]:
        """Fetch all events."""
        query = """
        {
          getEvents {
            eventId eventName eventDate typeOfEvent countryCode sponsor
            createdAt createdBy
            raceConfig {
              raceTimeInMin numberOfResetsPerLap trackType
              rankingMethod maxRunsPerRacer averageLapsWindow
            }
            tracks { trackId fleetId leaderBoardTitle leaderBoardFooter }
            landingPageConfig {
              links { linkName linkHref linkDescription }
            }
          }
        }
        """
        return self._gql(query)["getEvents"] or []

    def get_races(self, event_id: str) -> list[dict]:
        """Fetch all races for an event."""
        query = """
        query GetRaces($eventId: String!) {
          getRaces(eventId: $eventId) {
            raceId userId trackId racedByProxy createdAt eventId
            laps { lapId time resets isValid autTimerConnected carName }
            averageLaps { startLapId endLapId avgTime }
          }
        }
        """
        return self._gql(query, {"eventId": event_id})["getRaces"] or []

    def get_leaderboard(self, event_id: str, track_id: str | None = None) -> dict:
        """Fetch leaderboard for an event (optionally filtered by track)."""
        query = """
        query GetLeaderboard($eventId: ID!, $trackId: ID) {
          getLeaderboard(eventId: $eventId, trackId: $trackId) {
            config {
              leaderBoardFooter leaderBoardTitle sponsor
            }
            entries {
              avgLapTime avgLapsPerAttempt countryCode eventId
              fastestAverageLap { avgTime endLapId startLapId }
              fastestLapTime lapCompletionRatio mostConcecutiveLaps
              numberOfInvalidLaps numberOfValidLaps racedByProxy
              trackId username
            }
          }
        }
        """
        variables = {"eventId": event_id}
        if track_id:
            variables["trackId"] = track_id
        return self._gql(query, variables)["getLeaderboard"] or {}

    def get_all_fleets(self) -> list[dict]:
        """Fetch all fleets."""
        query = """
        {
          getAllFleets {
            fleetId fleetName createdAt createdBy carIds
          }
        }
        """
        return self._gql(query)["getAllFleets"] or []

    def get_racer_profile(self, username: str) -> dict | None:
        """Fetch a racer profile by username. Returns None if not set."""
        query = """
        query GetRacerProfile($username: String!) {
          getRacerProfile(username: $username) {
            username avatarConfig highlightColour updatedAt
          }
        }
        """
        return self._gql(query, {"username": username})["getRacerProfile"]

    def list_users(self) -> list[dict]:
        """
        Fetch all users via the listUsers query.
        Returns normalized user records matching the Cognito export format.
        """
        query = """
        {
          listUsers {
            Username sub Enabled UserStatus UserCreateDate
            Roles
            Attributes { Name Value }
          }
        }
        """
        raw_users = self._gql(query)["listUsers"] or []
        users = []
        for u in raw_users:
            attrs = {a["Name"]: a["Value"] for a in (u.get("Attributes") or [])}
            users.append({
                "username": u["Username"],
                "sub": u.get("sub") or attrs.get("sub", ""),
                "email": attrs.get("email", ""),
                "countryCode": attrs.get("custom:countryCode", ""),
                "enabled": u.get("Enabled", True),
                "status": u.get("UserStatus", ""),
                "created": str(u.get("UserCreateDate", "")),
                "groups": u.get("Roles") or [],
            })
        return users
