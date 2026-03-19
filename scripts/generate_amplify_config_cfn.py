import argparse
import json

# command line arguments
parser = argparse.ArgumentParser(
    description="Command line arguments",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)
parser.add_argument(
    "-d", "--docker", action="store_true", help="docker development mode"
)
args = parser.parse_args()
command_line_config = vars(args)

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
        if key["OutputKey"] == "LeaderboardWebsite":
            leaderboardWebsite = key["OutputValue"]
        if key["OutputKey"] == "streamingOverlayWebsite":
            streamingOverlayWebsite = key["OutputValue"]
        if key["OutputKey"] == "cwRumAppMonitorId":
            cwRumAppMonitorId = key["OutputValue"]
        if key["OutputKey"] == "cwRumAppMonitorRegion":
            cwRumAppMonitorRegion = key["OutputValue"]
        if key["OutputKey"] == "cwRumAppMonitorConfig":
            cwRumAppMonitorConfig = key["OutputValue"]

    if command_line_config["docker"] == True:
        leaderboardWebsite = "http://localhost:3001"
        streamingOverlayWebsite = "http://localhost:3002"

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
            "leaderboardWebsite": leaderboardWebsite,
            "streamingOverlayWebsite": streamingOverlayWebsite,
        },
        "Rum": {
            "drem": {
                "id": cwRumAppMonitorId,
                "region": cwRumAppMonitorRegion,
                "config": cwRumAppMonitorConfig,
            },
        },
    }

    print(json.dumps(output_data, indent=4))

    with open("website/src/config.json", "w") as outfile:
        json.dump(output_data, outfile, indent=4)

    with open("./appsyncId.txt", "w") as outfile:
        outfile.write(appsyncId)
