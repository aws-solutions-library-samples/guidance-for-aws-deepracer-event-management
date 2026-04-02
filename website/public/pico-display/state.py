class State:
    """
    Shared mutable state written by network tasks, read by display_task.
    Single-core MicroPython: no locking required.
    """
    event_name = None          # str | None — from eventName in subscription
    leaderboard_title = ""     # str — from getLeaderboard config.leaderBoardTitle
    leaderboard = []           # list[dict] — top N sorted entries
    race = None                # dict | None — current race data; None when no race active
    refresh_leaderboard = False  # set True by race_task on finish; leaderboard_task reacts
    ws_connected = False       # set True by race_task after start_ack; leaderboard_task waits for it
