import json

with open("cfn.outputs") as json_file:
    data = json.load(json_file)

    for key in data:
        if key["OutputKey"].startswith("apiGatewayEndpoint"):
            apiGatewayEndpoint = key["OutputValue"]
        if key["OutputKey"].startswith("appsyncEndpoint"):
            appsyncEndpoint = key["OutputValue"]
        # if key["OutputKey"] == "distributionId":
        #     distributionId = key["OutputValue"]
        # if key["OutputKey"] == "stackRegion":
        #     stackRegion = key["OutputValue"]
        if key["OutputKey"].startswith("userPoolWebClientId"):
            userPoolWebClientId = key["OutputValue"]
        # if key["OutputKey"] == "sourceBucketName":
        #     sourceBucketName = key["OutputValue"]
        if key["OutputKey"] == "modelsBucketName":
            modelsBucketName = key["OutputValue"]
        if key["OutputKey"] == "region":
            region = key["OutputValue"]
        # if key["OutputKey"] == "CFURL":
        #     CFURL = key["OutputValue"]
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
            "identityPoolId": identityPoolId,
        },
        "API": {
            "endpoints": [
                {
                    "name": "deepracerEventManager",
                    "endpoint": apiGatewayEndpoint,
                    "region": region,
                }
            ],
            "aws_appsync_graphqlEndpoint": appsyncEndpoint,
            "aws_appsync_region": region,
            "aws_appsync_authenticationType": "AWS_IAM",
        },
        "Urls": {
            "termsAndConditionsUrl": tacWebsite,
            "leaderboardWebsite": leaderboardWebsite,
            "streamingOverlayWebsite": streamingOverlayWebsite,
        },
    }

    print(json.dumps(output_data, indent=4))

    with open("website/src/config.json", "w") as outfile:
        json.dump(output_data, outfile, indent=4)

    with open("./appsyncId.txt", "w") as outfile:
        outfile.write(appsyncId)
