# To use overlays

## Regular Overlay:

https://{cloudfront-url}/EVENT_ID

## Overlay with Chroma Background (green):

https://{cloudfront-url}/EVENT_ID?chroma=1

#

## AppSync Subscriptions/Queries
### Subscriptions
- onNewOverlayInfo (Subscription)
  - This is what feeds the live active race data to the overlays.
- onNewLeaderboardEntry (Subscription)
  - This is used to capture when a race is "submitted" in order to refresh the leaderboard.
- getLeaderboard (Query)
  - This query is called when the "onNewLeaderboardEntry" subscription fires in order to obtain current leaderboard data. 
  - It is also used on page load to get initial state of the leaderboard.