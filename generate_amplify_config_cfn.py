import json

with open('cfn.outputs') as json_file:
    data = json.load(json_file)

    for key in data:
        if key['OutputKey'].startswith('apiGatewayEndpoint'):
             apiGatewayEndpoint = key['OutputValue']
        if key['OutputKey'].startswith('appsyncEndpoint'):
             appsyncEndpoint = key['OutputValue']
        if key['OutputKey'] == 'distributionId':
            distributionId = key['OutputValue']
        if key['OutputKey'] == 'stackRegion':
            stackRegion = key['OutputValue']
        if key['OutputKey'] == 'userPoolWebClientId':
            userPoolWebClientId = key['OutputValue']
        if key['OutputKey'] == 'sourceBucketName':
            sourceBucketName = key['OutputValue']
        if key['OutputKey'] == 'apiUrl':
            apiUrl = key['OutputValue']
        if key['OutputKey'] == 'modelsBucketName':
            modelsBucketName = key['OutputValue']
        if key['OutputKey'] == 'region':
            region = key['OutputValue']
        if key['OutputKey'] == 'CFURL':
            CFURL = key['OutputValue']
        if key['OutputKey'] == 'userPoolId':
            userPoolId = key['OutputValue']
        if key['OutputKey'] == 'identityPoolId':
            identityPoolId = key['OutputValue']
        if key['OutputKey'] == 'appsyncId':
            appsyncId = key['OutputValue']

    output_data = {
        "Auth": {
            "region": region,
            "userPoolId": userPoolId,
            "userPoolWebClientId": userPoolWebClientId,
            "identityPoolId": identityPoolId
        },
        "Storage": {
            "region": region,
            "bucket": modelsBucketName,
            "identityPoolId":identityPoolId
        },
        "API": {
            "endpoints": [
                {
                    "name": "deepracerEventManager",
                    "endpoint": apiGatewayEndpoint,
                    "region": region
                }
            ],
            "aws_appsync_graphqlEndpoint": appsyncEndpoint,
            "aws_appsync_region": region,
            "aws_appsync_authenticationType": "AWS_IAM"
        }
    }

    print(json.dumps(output_data, indent=4))

    with open('website/src/config.json', 'w') as outfile:
        json.dump(output_data, outfile, indent=4)

    with open('./appsyncId.txt', 'w') as outfile:
        outfile.write(appsyncId)
