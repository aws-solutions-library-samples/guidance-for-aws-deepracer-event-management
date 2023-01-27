"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestApi = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const apigw = require("aws-cdk-lib/aws-apigateway");
const logs = require("aws-cdk-lib/aws-logs");
const constructs_1 = require("constructs");
class RestApi extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const stack = aws_cdk_lib_1.Stack.of(this);
        const apig_log_group = new logs.LogGroup(this, "apig_log_group", { retention: logs.RetentionDays.ONE_MONTH });
        const restApi = new apigw.RestApi(this, "api", {
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
                    "http://localhost:3000",
                    "https://" + props.cloudFrontDistributionName,
                ],
                allowCredentials: true,
            }
        });
        // API Validation models
        restApi.addModel("hostanameModel", {
            contentType: "application/json",
            schema: {
                schema: apigw.JsonSchemaVersion.DRAFT4,
                type: apigw.JsonSchemaType.OBJECT,
                properties: {
                    "hostname": { type: apigw.JsonSchemaType.STRING },
                },
            }
        });
        restApi.addModel("UsernameModel", {
            contentType: "application/json",
            schema: {
                schema: apigw.JsonSchemaVersion.DRAFT4,
                type: apigw.JsonSchemaType.OBJECT,
                properties: {
                    "username": { type: apigw.JsonSchemaType.STRING }
                },
            }
        });
        // Base API structure
        // /admin
        this.apiAdminResource = restApi.root.addResource("admin");
        const bodyValidator = new apigw.RequestValidator(this, "BodyValidator", {
            restApi: restApi,
            validateRequestBody: true,
        });
        this.bodyValidator = bodyValidator;
        const instanceidCommandidModel = restApi.addModel("IanstanceIdCommandIdModel", {
            contentType: "application/json",
            schema: {
                schema: apigw.JsonSchemaVersion.DRAFT4,
                type: apigw.JsonSchemaType.OBJECT,
                properties: {
                    "InstanceId": { type: apigw.JsonSchemaType.STRING },
                    "CommandId": { type: apigw.JsonSchemaType.STRING },
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
exports.RestApi = RestApi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzdC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZXN0LWFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBb0M7QUFDcEMsb0RBQW9EO0FBQ3BELDZDQUE2QztBQUM3QywyQ0FBdUM7QUFRdkMsTUFBYSxPQUFRLFNBQVEsc0JBQVM7SUFNbEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFtQjtRQUN6RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sS0FBSyxHQUFHLG1CQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFBO1FBRTVCLE1BQU0sY0FBYyxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FDcEMsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxFQUFFLENBQ3RFLENBQUE7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQzdCLElBQUksRUFDSixLQUFLLEVBQUU7WUFDUCxXQUFXLEVBQUUsS0FBSyxDQUFDLFNBQVM7WUFDNUIsYUFBYSxFQUFFO2dCQUNYLG1CQUFtQixFQUFFLEVBQUU7Z0JBQ3ZCLG9CQUFvQixFQUFFLEVBQUU7Z0JBQ3hCLGNBQWMsRUFBRSxJQUFJO2dCQUNwQixvQkFBb0IsRUFBRSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxjQUFjLENBQUM7Z0JBQ3RFLGVBQWUsRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLHNCQUFzQixDQUFDO29CQUMxRCxNQUFNLEVBQUUsSUFBSTtvQkFDWixVQUFVLEVBQUUsSUFBSTtvQkFDaEIsRUFBRSxFQUFFLElBQUk7b0JBQ1IsUUFBUSxFQUFFLElBQUk7b0JBQ2QsV0FBVyxFQUFFLElBQUk7b0JBQ2pCLFlBQVksRUFBRSxJQUFJO29CQUNsQixjQUFjLEVBQUUsSUFBSTtvQkFDcEIsTUFBTSxFQUFFLElBQUk7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QUNoRiwrRUFBK0U7UUFDL0UsYUFBYTtRQUNiLFNBQVM7UUFDVCxJQUFJO1FBRUosbURBQW1EO1FBQ25ELHlCQUF5QjtRQUN6Qix1Q0FBdUM7UUFDdkMsK0JBQStCO1FBQy9CLGlEQUFpRDtRQUNqRCw0Q0FBNEM7UUFDNUMsdUJBQXVCO1FBQ3ZCLGdGQUFnRjtRQUNoRixhQUFhO1FBQ2IsU0FBUztRQUNULElBQUk7SUFFUixDQUFDO0NBQ0o7QUFySkQsMEJBcUpDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3RhY2sgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBhcGlndyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzdEFwaVByb3BzIHtcbiAgICBjbG91ZEZyb250RGlzdHJpYnV0aW9uTmFtZTogc3RyaW5nXG5cbn1cblxuZXhwb3J0IGNsYXNzIFJlc3RBcGkgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAgIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWd3LlJlc3RBcGk7XG4gICAgcHVibGljIHJlYWRvbmx5IGFwaUFkbWluUmVzb3VyY2U6IGFwaWd3LlJlc291cmNlO1xuICAgIHB1YmxpYyByZWFkb25seSBib2R5VmFsaWRhdG9yOiBhcGlndy5SZXF1ZXN0VmFsaWRhdG9yO1xuICAgIHB1YmxpYyByZWFkb25seSBpbnN0YW5jZWlkQ29tbWFuZGlkTW9kZWw6IGFwaWd3Lk1vZGVsXG5cbiAgICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUmVzdEFwaVByb3BzKSB7XG4gICAgICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAgICAgY29uc3Qgc3RhY2sgPSBTdGFjay5vZih0aGlzKVxuXG4gICAgICAgIGNvbnN0IGFwaWdfbG9nX2dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAoXG4gICAgICAgICAgICB0aGlzLCBcImFwaWdfbG9nX2dyb3VwXCIsIHsgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRIIH1cbiAgICAgICAgKVxuXG4gICAgICAgIGNvbnN0IHJlc3RBcGkgPSBuZXcgYXBpZ3cuUmVzdEFwaShcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBcImFwaVwiLCB7XG4gICAgICAgICAgICByZXN0QXBpTmFtZTogc3RhY2suc3RhY2tOYW1lLFxuICAgICAgICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICAgICAgICAgIHRocm90dGxpbmdSYXRlTGltaXQ6IDEwLFxuICAgICAgICAgICAgICAgIHRocm90dGxpbmdCdXJzdExpbWl0OiAyMCxcbiAgICAgICAgICAgICAgICB0cmFjaW5nRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhY2Nlc3NMb2dEZXN0aW5hdGlvbjogbmV3IGFwaWd3LkxvZ0dyb3VwTG9nRGVzdGluYXRpb24oYXBpZ19sb2dfZ3JvdXApLFxuICAgICAgICAgICAgICAgIGFjY2Vzc0xvZ0Zvcm1hdDogYXBpZ3cuQWNjZXNzTG9nRm9ybWF0Lmpzb25XaXRoU3RhbmRhcmRGaWVsZHMoe1xuICAgICAgICAgICAgICAgICAgICBjYWxsZXI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGh0dHBNZXRob2Q6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGlwOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBwcm90b2NvbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdFRpbWU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlUGF0aDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VMZW5ndGg6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgdXNlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWd3Lk1ldGhvZExvZ2dpbmdMZXZlbC5FUlJPUixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBhbGxvd09yaWdpbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgICAgICAgICAgICAgICAgICAgXCJodHRwczovL1wiICsgcHJvcHMuY2xvdWRGcm9udERpc3RyaWJ1dGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiB0cnVlLFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIEFQSSBWYWxpZGF0aW9uIG1vZGVsc1xuICAgICAgICByZXN0QXBpLmFkZE1vZGVsKFxuICAgICAgICAgICAgXCJob3N0YW5hbWVNb2RlbFwiLCB7XG4gICAgICAgICAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgICBzY2hlbWE6IGFwaWd3Lkpzb25TY2hlbWFWZXJzaW9uLkRSQUZUNCxcbiAgICAgICAgICAgICAgICB0eXBlOiBhcGlndy5Kc29uU2NoZW1hVHlwZS5PQkpFQ1QsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBcImhvc3RuYW1lXCI6IHsgdHlwZTogYXBpZ3cuSnNvblNjaGVtYVR5cGUuU1RSSU5HIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICByZXN0QXBpLmFkZE1vZGVsKFxuICAgICAgICAgICAgXCJVc2VybmFtZU1vZGVsXCIsIHtcbiAgICAgICAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIHNjaGVtYToge1xuICAgICAgICAgICAgICAgIHNjaGVtYTogYXBpZ3cuSnNvblNjaGVtYVZlcnNpb24uRFJBRlQ0LFxuICAgICAgICAgICAgICAgIHR5cGU6IGFwaWd3Lkpzb25TY2hlbWFUeXBlLk9CSkVDVCxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIFwidXNlcm5hbWVcIjogeyB0eXBlOiBhcGlndy5Kc29uU2NoZW1hVHlwZS5TVFJJTkd9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvLyBCYXNlIEFQSSBzdHJ1Y3R1cmVcbiAgICAgICAgLy8gL2FkbWluXG4gICAgICAgIHRoaXMuYXBpQWRtaW5SZXNvdXJjZSA9IHJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZShcImFkbWluXCIpXG5cbiAgICAgICAgY29uc3QgYm9keVZhbGlkYXRvciA9IG5ldyBhcGlndy5SZXF1ZXN0VmFsaWRhdG9yKFxuICAgICAgICAgICAgdGhpcywgXCJCb2R5VmFsaWRhdG9yXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGk6IHJlc3RBcGksXG4gICAgICAgICAgICB2YWxpZGF0ZVJlcXVlc3RCb2R5OiB0cnVlLFxuICAgICAgICB9KVxuXG4gICAgICAgIHRoaXMuYm9keVZhbGlkYXRvciA9IGJvZHlWYWxpZGF0b3JcblxuICAgICAgICBjb25zdCBpbnN0YW5jZWlkQ29tbWFuZGlkTW9kZWwgPSByZXN0QXBpLmFkZE1vZGVsKFxuICAgICAgICAgICAgXCJJYW5zdGFuY2VJZENvbW1hbmRJZE1vZGVsXCIsIHtcbiAgICAgICAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIHNjaGVtYToge1xuICAgICAgICAgICAgICAgIHNjaGVtYTogYXBpZ3cuSnNvblNjaGVtYVZlcnNpb24uRFJBRlQ0LFxuICAgICAgICAgICAgICAgIHR5cGU6IGFwaWd3Lkpzb25TY2hlbWFUeXBlLk9CSkVDVCxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIFwiSW5zdGFuY2VJZFwiOiB7IHR5cGU6IGFwaWd3Lkpzb25TY2hlbWFUeXBlLlNUUklORyB9LFxuICAgICAgICAgICAgICAgICAgICBcIkNvbW1hbmRJZFwiOiB7IHR5cGU6IGFwaWd3Lkpzb25TY2hlbWFUeXBlLlNUUklORyB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmluc3RhbmNlaWRDb21tYW5kaWRNb2RlbCA9IGluc3RhbmNlaWRDb21tYW5kaWRNb2RlbFxuXG4gICAgICAgIC8vIFRPRE8gYXJlIHRoZXNlIG1ldGhvZHMgbmVlZGVkPz8/P1xuICAgICAgICAvLyAvLyBBUEkgVmFsaWRhdGlvbiBtb2RlbHNcbiAgICAgICAgLy8gYmFzZV9zdGFjay5yZXN0X2FwaS5hZGRNb2RlbChcbiAgICAgICAgLy8gICAgIFwiaG9zdGFuYW1lTW9kZWxcIixcbiAgICAgICAgLy8gICAgIGNvbnRlbnRUeXBlOj1cImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgLy8gICAgIHNjaGVtYT1hcGlndy5Kc29uU2NoZW1hKFxuICAgICAgICAvLyAgICAgICAgIHNjaGVtYT1hcGlndy5Kc29uU2NoZW1hVmVyc2lvbi5EUkFGVDQsXG4gICAgICAgIC8vICAgICAgICAgdHlwZT1hcGlndy5Kc29uU2NoZW1hVHlwZS5PQkpFQ1QsXG4gICAgICAgIC8vICAgICAgICAgcHJvcGVydGllcz17XG4gICAgICAgIC8vICAgICAgICAgICAgIFwiaG9zdG5hbWVcIjogYXBpZ3cuSnNvblNjaGVtYSh0eXBlPWFwaWd3Lkpzb25TY2hlbWFUeXBlLlNUUklORyksXG4gICAgICAgIC8vICAgICAgICAgfSxcbiAgICAgICAgLy8gICAgICksXG4gICAgICAgIC8vIClcblxuICAgICAgICAvLyBiYXNlX3N0YWNrLnJlc3RfYXBpLmFkZE1vZGVsKFxuICAgICAgICAvLyAgICAgXCJVc2VybmFtZU1vZGVsXCIsXG4gICAgICAgIC8vICAgICBjb250ZW50VHlwZTo9XCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIC8vICAgICBzY2hlbWE9YXBpZ3cuSnNvblNjaGVtYShcbiAgICAgICAgLy8gICAgICAgICBzY2hlbWE9YXBpZ3cuSnNvblNjaGVtYVZlcnNpb24uRFJBRlQ0LFxuICAgICAgICAvLyAgICAgICAgIHR5cGU9YXBpZ3cuSnNvblNjaGVtYVR5cGUuT0JKRUNULFxuICAgICAgICAvLyAgICAgICAgIHByb3BlcnRpZXM9e1xuICAgICAgICAvLyAgICAgICAgICAgICBcInVzZXJuYW1lXCI6IGFwaWd3Lkpzb25TY2hlbWEodHlwZT1hcGlndy5Kc29uU2NoZW1hVHlwZS5TVFJJTkcpLFxuICAgICAgICAvLyAgICAgICAgIH0sXG4gICAgICAgIC8vICAgICApLFxuICAgICAgICAvLyApXG5cbiAgICAgICAgLy8gaW5zdGFuY2VpZF9jb21tYW5kaWRfbW9kZWwgPSBiYXNlX3N0YWNrLnJlc3RfYXBpLmFkZE1vZGVsKFxuICAgICAgICAvLyAgICAgXCJJYW5zdGFuY2VJZENvbW1hbmRJZE1vZGVsXCIsXG4gICAgICAgIC8vICAgICBjb250ZW50VHlwZTo9XCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIC8vICAgICBzY2hlbWE9YXBpZ3cuSnNvblNjaGVtYShcbiAgICAgICAgLy8gICAgICAgICBzY2hlbWE9YXBpZ3cuSnNvblNjaGVtYVZlcnNpb24uRFJBRlQ0LFxuICAgICAgICAvLyAgICAgICAgIHR5cGU9YXBpZ3cuSnNvblNjaGVtYVR5cGUuT0JKRUNULFxuICAgICAgICAvLyAgICAgICAgIHByb3BlcnRpZXM9e1xuICAgICAgICAvLyAgICAgICAgICAgICBcIkluc3RhbmNlSWRcIjogYXBpZ3cuSnNvblNjaGVtYSh0eXBlPWFwaWd3Lkpzb25TY2hlbWFUeXBlLlNUUklORyksXG4gICAgICAgIC8vICAgICAgICAgICAgIFwiQ29tbWFuZElkXCI6IGFwaWd3Lkpzb25TY2hlbWEodHlwZT1hcGlndy5Kc29uU2NoZW1hVHlwZS5TVFJJTkcpLFxuICAgICAgICAvLyAgICAgICAgIH0sXG4gICAgICAgIC8vICAgICApLFxuICAgICAgICAvLyApXG5cbiAgICAgICAgLy8gaW5zdGFuY2VpZF9tb2RlbCA9IGJhc2Vfc3RhY2sucmVzdF9hcGkuYWRkTW9kZWwoXG4gICAgICAgIC8vICAgICBcIkluc3RhbmNlSWRNb2RlbFwiLFxuICAgICAgICAvLyAgICAgY29udGVudFR5cGU6PVwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAvLyAgICAgc2NoZW1hPWFwaWd3Lkpzb25TY2hlbWEoXG4gICAgICAgIC8vICAgICAgICAgc2NoZW1hPWFwaWd3Lkpzb25TY2hlbWFWZXJzaW9uLkRSQUZUNCxcbiAgICAgICAgLy8gICAgICAgICB0eXBlPWFwaWd3Lkpzb25TY2hlbWFUeXBlLk9CSkVDVCxcbiAgICAgICAgLy8gICAgICAgICBwcm9wZXJ0aWVzPXtcbiAgICAgICAgLy8gICAgICAgICAgICAgXCJJbnN0YW5jZUlkXCI6IGFwaWd3Lkpzb25TY2hlbWEodHlwZT1hcGlndy5Kc29uU2NoZW1hVHlwZS5TVFJJTkcpLFxuICAgICAgICAvLyAgICAgICAgIH0sXG4gICAgICAgIC8vICAgICApLFxuICAgICAgICAvLyApXG5cbiAgICB9XG59Il19