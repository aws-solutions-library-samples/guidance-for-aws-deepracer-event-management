import { Stack } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface RestApiProps {
    cloudFrontDistributionName: string;
}

export class RestApi extends Construct {
    public readonly api: apigw.RestApi;
    public readonly apiAdminResource: apigw.Resource;
    public readonly bodyValidator: apigw.RequestValidator;
    public readonly instanceidCommandidModel: apigw.Model;

    constructor(scope: Construct, id: string, props: RestApiProps) {
        super(scope, id);

        const stack = Stack.of(this);

        const apig_log_group = new logs.LogGroup(this, 'apig_log_group', {
            retention: logs.RetentionDays.ONE_MONTH,
        });

        const restApi = new apigw.RestApi(this, 'api', {
            restApiName: stack.stackName,
            deployOptions: {
                throttlingRateLimit: 10,
                throttlingBurstLimit: 20,
                tracingEnabled: true,
                accessLogDestination: new apigw.LogGroupLogDestination(apig_log_group),
                accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields({
                    caller: true,
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    user: true,
                }),
                loggingLevel: apigw.MethodLoggingLevel.ERROR,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: [
                    'http://localhost:3000',
                    'https://' + props.cloudFrontDistributionName,
                ],
                allowCredentials: true,
            },
        });

        this.api = restApi;

        // API Validation models
        restApi.addModel('hostanameModel', {
            contentType: 'application/json',
            schema: {
                schema: apigw.JsonSchemaVersion.DRAFT4,
                type: apigw.JsonSchemaType.OBJECT,
                properties: {
                    hostname: { type: apigw.JsonSchemaType.STRING },
                },
            },
        });

        restApi.addModel('UsernameModel', {
            contentType: 'application/json',
            schema: {
                schema: apigw.JsonSchemaVersion.DRAFT4,
                type: apigw.JsonSchemaType.OBJECT,
                properties: {
                    username: { type: apigw.JsonSchemaType.STRING },
                },
            },
        });

        // Base API structure
        // /admin
        this.apiAdminResource = restApi.root.addResource('admin');

        const bodyValidator = new apigw.RequestValidator(this, 'BodyValidator', {
            restApi: restApi,
            validateRequestBody: true,
        });

        this.bodyValidator = bodyValidator;

        const instanceidCommandidModel = restApi.addModel('IanstanceIdCommandIdModel', {
            contentType: 'application/json',
            schema: {
                schema: apigw.JsonSchemaVersion.DRAFT4,
                type: apigw.JsonSchemaType.OBJECT,
                properties: {
                    InstanceId: { type: apigw.JsonSchemaType.STRING },
                    CommandId: { type: apigw.JsonSchemaType.STRING },
                },
            },
        });
        this.instanceidCommandidModel = instanceidCommandidModel;

        // TODO are these methods needed????
        // // API Validation models
        // base_stack.rest_api.addModel(
        //     "hostanameModel",
        //     contentType:="application/json",
        //     schema=apigw.JsonSchema(
        //         schema=apigw.JsonSchemaVersion.DRAFT4,
        //         type=apigw.JsonSchemaType.OBJECT,
        //         properties={
        //             "hostname": apigw.JsonSchema(type=apigw.JsonSchemaType.STRING),
        //         },
        //     ),
        // )

        // base_stack.rest_api.addModel(
        //     "UsernameModel",
        //     contentType:="application/json",
        //     schema=apigw.JsonSchema(
        //         schema=apigw.JsonSchemaVersion.DRAFT4,
        //         type=apigw.JsonSchemaType.OBJECT,
        //         properties={
        //             "username": apigw.JsonSchema(type=apigw.JsonSchemaType.STRING),
        //         },
        //     ),
        // )

        // instanceid_commandid_model = base_stack.rest_api.addModel(
        //     "IanstanceIdCommandIdModel",
        //     contentType:="application/json",
        //     schema=apigw.JsonSchema(
        //         schema=apigw.JsonSchemaVersion.DRAFT4,
        //         type=apigw.JsonSchemaType.OBJECT,
        //         properties={
        //             "InstanceId": apigw.JsonSchema(type=apigw.JsonSchemaType.STRING),
        //             "CommandId": apigw.JsonSchema(type=apigw.JsonSchemaType.STRING),
        //         },
        //     ),
        // )

        // instanceid_model = base_stack.rest_api.addModel(
        //     "InstanceIdModel",
        //     contentType:="application/json",
        //     schema=apigw.JsonSchema(
        //         schema=apigw.JsonSchemaVersion.DRAFT4,
        //         type=apigw.JsonSchemaType.OBJECT,
        //         properties={
        //             "InstanceId": apigw.JsonSchema(type=apigw.JsonSchemaType.STRING),
        //         },
        //     ),
        // )
    }
}
