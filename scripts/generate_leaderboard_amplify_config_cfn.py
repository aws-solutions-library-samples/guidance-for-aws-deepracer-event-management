import json

with open("cfn.outputs") as json_file:
    data = json.load(json_file)

    for key in data:
        if key["OutputKey"].startswith("appsyncEndpoint"):
            appsyncEndpoint = key["OutputValue"]
        if key["OutputKey"] == "region":
            region = key["OutputValue"]
        if key["OutputKey"] == "appsyncId":
            appsyncId = key["OutputValue"]
        if key["OutputKey"] == "appsyncApiKey":
            appsyncApiKey = key["OutputValue"]
        if key["OutputKey"] == "DremWebsite":
            DremWebsite = key["OutputValue"]
        if key["OutputKey"] == "cwRumLeaderboardAppMonitorId":
            cwRumLeaderboardAppMonitorId = key["OutputValue"]
        if key["OutputKey"] == "cwRumLeaderboardAppMonitorConfig":
            cwRumLeaderboardAppMonitorConfig = key["OutputValue"]

    output_data = {
        "API": {
            "aws_appsync_graphqlEndpoint": appsyncEndpoint,
            "aws_appsync_region": region,
            "aws_appsync_authenticationType": "API_KEY",
            "aws_appsync_apiKey": appsyncApiKey,
        },
        "Urls": {
            "drem": DremWebsite,
        },
        "Rum": {
            "leaderboard": {
                "id": cwRumLeaderboardAppMonitorId,
                "config": cwRumLeaderboardAppMonitorConfig,
            },
        },
    }

    print(json.dumps(output_data, indent=4))

    with open("website-leaderboard/src/config.json", "w") as outfile:
        json.dump(output_data, outfile, indent=4)

#
