import json

with open("cfn.outputs") as json_file:
    data = json.load(json_file)

    for key in data:
        if key["OutputKey"].startswith("appsyncEndpoint"):
            appsyncEndpoint = key["OutputValue"]
        if key["OutputKey"].startswith("userPoolWebClientId"):
            userPoolWebClientId = key["OutputValue"]
        if key["OutputKey"] == "uploadBucketName":
            uploadBucketName = key["OutputValue"]
        if key["OutputKey"] == "modelsBucketName":
            modelsBucketName = key["OutputValue"]
        if key["OutputKey"] == "region":
            region = key["OutputValue"]
        if key["OutputKey"].startswith("userPoolId"):
            userPoolId = key["OutputValue"]
        if key["OutputKey"].startswith("identityPoolId"):
            identityPoolId = key["OutputValue"]
        if key["OutputKey"] == "appsyncId":
            appsyncId = key["OutputValue"]
        if key["OutputKey"] == "tacWebsite":
            tacWebsite = key["OutputValue"]
        if key["OutputKey"] == "LeaderboardWebsite":
            leaderboardWebsite = key["OutputValue"]
        if key["OutputKey"] == "streamingOverlayWebsite":
            streamingOverlayWebsite = key["OutputValue"]
        if key["OutputKey"] == "cwRumAppMonitorId":
            cwRumAppMonitorId = key["OutputValue"]
        if key["OutputKey"] == "cwRumAppMonitorConfig":
            cwRumAppMonitorConfig = key["OutputValue"]

    output_data = {
        "Auth": {
            "region": region,
            "userPoolId": userPoolId,
            "userPoolWebClientId": userPoolWebClientId,
            "identityPoolId": identityPoolId,
        },
        "Storage": {
            "region": region,
            "bucket": modelsBucketName,
            "uploadBucket": uploadBucketName,
            "identityPoolId": identityPoolId,
        },
        "API": {
            "aws_appsync_graphqlEndpoint": appsyncEndpoint,
            "aws_appsync_region": region,
            "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS",
        },
        "Urls": {
            "termsAndConditionsUrl": tacWebsite,
            "leaderboardWebsite": leaderboardWebsite,
            "streamingOverlayWebsite": streamingOverlayWebsite,
        },
        "Rum": {
            "drem": {
                "id": cwRumAppMonitorId,
                "config": cwRumAppMonitorConfig,
            },
        },
    }

    print(json.dumps(output_data, indent=4))

    with open("website/src/config.json", "w") as outfile:
        json.dump(output_data, outfile, indent=4)

    with open("./appsyncId.txt", "w") as outfile:
        outfile.write(appsyncId)
