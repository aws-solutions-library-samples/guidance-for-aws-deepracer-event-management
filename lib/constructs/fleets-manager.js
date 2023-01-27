"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetsManager = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const appsync = require("aws-cdk-lib/aws-appsync");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const iam = require("aws-cdk-lib/aws-iam");
const lambda = require("aws-cdk-lib/aws-lambda");
const lambdaPython = require("@aws-cdk/aws-lambda-python-alpha");
const awscdk_appsync_utils_1 = require("awscdk-appsync-utils");
const constructs_1 = require("constructs");
class FleetsManager extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const fleets_table = new dynamodb.Table(this, "FleetsTable", {
            partitionKey: {
                name: "fleetId", type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        const fleets_handler = new lambdaPython.PythonFunction(this, "fleetsFunction", {
            entry: "lib/lambdas/fleets_function/",
            description: "Fleets Resolver",
            index: "index.py",
            handler: "lambda_handler",
            timeout: aws_cdk_lib_1.Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            bundling: {
                image: props.lambdaConfig.bundlingImage
            },
            //            layers: [base_stack._powertools_layer],   // TODO uncomment when fixed in base stack
            environment: {
                "DDB_TABLE": fleets_table.tableName,
                "user_pool_id": props.userPoolId,
                "POWERTOOLS_SERVICE_NAME": "fleets_resolver",
                "LOG_LEVEL": props.lambdaConfig.layersConfig.powerToolsLogLevel,
            },
        });
        fleets_table.grantReadWriteData(fleets_handler);
        // Define the data source for the API
        const fleets_data_source = props.appsyncApi.api.addLambdaDataSource("FleetsDataSource", fleets_handler);
        // Define API Schema
        const fleets_object_Type = new awscdk_appsync_utils_1.ObjectType("Fleet", {
            definition: {
                "fleetName": awscdk_appsync_utils_1.GraphqlType.string(),
                "fleetId": awscdk_appsync_utils_1.GraphqlType.id(),
                "createdAt": awscdk_appsync_utils_1.GraphqlType.awsDateTime(),
                "carIds": awscdk_appsync_utils_1.GraphqlType.id({ isList: true }),
            },
        });
        props.appsyncApi.schema.addType(fleets_object_Type);
        // Fleet methods
        props.appsyncApi.schema.addQuery("getAllFleets", new awscdk_appsync_utils_1.ResolvableField({
            returnType: fleets_object_Type.attribute({ isList: true }),
            dataSource: fleets_data_source,
        }));
        props.appsyncApi.schema.addMutation("addFleet", new awscdk_appsync_utils_1.ResolvableField({
            args: {
                "fleetName": awscdk_appsync_utils_1.GraphqlType.string({ isRequired: true }),
                "carIds": awscdk_appsync_utils_1.GraphqlType.string({ isList: true }),
            },
            returnType: fleets_object_Type.attribute(),
            dataSource: fleets_data_source,
        }));
        props.appsyncApi.schema.addSubscription("onAddedFleet", new awscdk_appsync_utils_1.ResolvableField({
            returnType: fleets_object_Type.attribute(),
            dataSource: props.appsyncApi.noneDataSource,
            requestMappingTemplate: appsync.MappingTemplate.fromString(`{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`),
            responseMappingTemplate: appsync.MappingTemplate.fromString("$util.toJson($context.result)"),
            directives: [awscdk_appsync_utils_1.Directive.subscribe("addFleet")],
        }));
        props.appsyncApi.schema.addMutation("deleteFleets", new awscdk_appsync_utils_1.ResolvableField({
            args: { "fleetIds": awscdk_appsync_utils_1.GraphqlType.string({ isRequiredList: true }) },
            returnType: fleets_object_Type.attribute({ isList: true }),
            dataSource: fleets_data_source,
        }));
        props.appsyncApi.schema.addSubscription("onDeletedFleets", new awscdk_appsync_utils_1.ResolvableField({
            returnType: fleets_object_Type.attribute({ isList: true }),
            dataSource: props.appsyncApi.noneDataSource,
            requestMappingTemplate: appsync.MappingTemplate.fromString(`{
                        "version": "2017-02-28",
                    "payload": $util.toJson($context.arguments.entry)
                    }`),
            responseMappingTemplate: appsync.MappingTemplate.fromString("$util.toJson($context.result)"),
            directives: [awscdk_appsync_utils_1.Directive.subscribe("deleteFleets")],
        }));
        props.appsyncApi.schema.addMutation("updateFleet", new awscdk_appsync_utils_1.ResolvableField({
            args: {
                "fleetId": awscdk_appsync_utils_1.GraphqlType.string({ isRequired: true }),
                "fleetName": awscdk_appsync_utils_1.GraphqlType.string(),
                "carIds": awscdk_appsync_utils_1.GraphqlType.id({ isList: true }),
            },
            returnType: fleets_object_Type.attribute(),
            dataSource: fleets_data_source,
        }));
        props.appsyncApi.schema.addSubscription("onUpdatedFleet", new awscdk_appsync_utils_1.ResolvableField({
            returnType: fleets_object_Type.attribute(),
            dataSource: props.appsyncApi.noneDataSource,
            requestMappingTemplate: appsync.MappingTemplate.fromString(`{
                        "version": "2017-02-28",
                    "payload": $util.toJson($context.arguments.entry)
                    }`),
            responseMappingTemplate: appsync.MappingTemplate.fromString("$util.toJson($context.result)"),
            directives: [awscdk_appsync_utils_1.Directive.subscribe("updateFleet")],
        }));
        // Grant access so API methods can be invoked
        const admin_api_policy = new iam.Policy(this, "adminApiPolicy", {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ["appsync:GraphQL"],
                    resources: [
                        `${props.appsyncApi.api.arn}/types/Query/fields/getAllFleets`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/addFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/addedFleet`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/deleteFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/deletedFleet`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/updateFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/addedFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/deletedFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/updatedFleet`,
                    ],
                })
            ],
        });
        admin_api_policy.attachToRole(props.adminGroupRole);
    }
}
exports.FleetsManager = FleetsManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxlZXRzLW1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJmbGVldHMtbWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw2Q0FBbUU7QUFDbkUsbURBQW1EO0FBQ25ELHFEQUFxRDtBQUNyRCwyQ0FBMkM7QUFFM0MsaURBQWlEO0FBR2pELGlFQUFpRTtBQUNqRSwrREFBMkY7QUFHM0YsMkNBQXVDO0FBcUJ2QyxNQUFhLGFBQWMsU0FBUSxzQkFBUztJQUN4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxZQUFZLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUNuQyxJQUFJLEVBQ0osYUFBYSxFQUFFO1lBQ2YsWUFBWSxFQUFFO2dCQUNWLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUN2RDtZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUNoRCxhQUFhLEVBQUUsMkJBQWEsQ0FBQyxPQUFPO1NBQ3ZDLENBQUMsQ0FBQTtRQUVGLE1BQU0sY0FBYyxHQUFHLElBQUksWUFBWSxDQUFDLGNBQWMsQ0FDbEQsSUFBSSxFQUNKLGdCQUFnQixFQUFFO1lBQ2xCLEtBQUssRUFBRSw4QkFBOEI7WUFDckMsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixLQUFLLEVBQUUsVUFBVTtZQUNqQixPQUFPLEVBQUUsZ0JBQWdCO1lBQ3pCLE9BQU8sRUFBRSxzQkFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDNUIsT0FBTyxFQUFFLEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBTztZQUNuQyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1lBQzlCLFVBQVUs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QUcsdUNBQXVDO3dCQUNsRSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcseUNBQXlDO3dCQUNwRSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcseUNBQXlDO3FCQUN2RTtpQkFDSixDQUFDO2FBQ0w7U0FDSixDQUFDLENBQUE7UUFDRixnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFBO0lBRTNELENBQUM7Q0FDQTtBQWhMRCxzQ0FnTEMiLCJzb3VyY2VzQ29udGVudCI6WyJcbmltcG9ydCB7IERvY2tlckltYWdlLCBEdXJhdGlvbiwgUmVtb3ZhbFBvbGljeSB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFwcHN5bmMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwcHN5bmMnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IElSb2xlIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBDb2RlRmlyc3RTY2hlbWEgfSBmcm9tICdhd3NjZGstYXBwc3luYy11dGlscyc7XG5cbmltcG9ydCAqIGFzIGxhbWJkYVB5dGhvbiBmcm9tICdAYXdzLWNkay9hd3MtbGFtYmRhLXB5dGhvbi1hbHBoYSc7XG5pbXBvcnQgeyBEaXJlY3RpdmUsIEdyYXBocWxUeXBlLCBPYmplY3RUeXBlLCBSZXNvbHZhYmxlRmllbGQgfSBmcm9tICdhd3NjZGstYXBwc3luYy11dGlscyc7XG5cblxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmxlZXRzTWFuYWdlclByb3BzIHtcbiAgICBhZG1pbkdyb3VwUm9sZTogSVJvbGUsXG4gICAgdXNlclBvb2xJZDogc3RyaW5nLFxuICAgIGFwcHN5bmNBcGk6IHtcbiAgICAgICAgc2NoZW1hOiBDb2RlRmlyc3RTY2hlbWEsXG4gICAgICAgIGFwaTogYXBwc3luYy5JR3JhcGhxbEFwaVxuICAgICAgICBub25lRGF0YVNvdXJjZTogYXBwc3luYy5Ob25lRGF0YVNvdXJjZVxuICAgIH0sXG4gICAgbGFtYmRhQ29uZmlnOiB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLFxuICAgICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUsXG4gICAgICAgIGJ1bmRsaW5nSW1hZ2U6IERvY2tlckltYWdlXG4gICAgICAgIGxheWVyc0NvbmZpZzoge1xuICAgICAgICAgICAgcG93ZXJUb29sc0xvZ0xldmVsOiBzdHJpbmdcbiAgICAgICAgfVxuICAgIH1cblxufVxuXG5leHBvcnQgY2xhc3MgRmxlZXRzTWFuYWdlciBleHRlbmRzIENvbnN0cnVjdCB7XG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEZsZWV0c01hbmFnZXJQcm9wcykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIGNvbnN0IGZsZWV0c190YWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZShcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBcIkZsZWV0c1RhYmxlXCIsIHtcbiAgICAgICAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICAgICAgICAgIG5hbWU6IFwiZmxlZXRJZFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICAgICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAgIH0pXG5cbiAgICAgICAgY29uc3QgZmxlZXRzX2hhbmRsZXIgPSBuZXcgbGFtYmRhUHl0aG9uLlB5dGhvbkZ1bmN0aW9uKFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIFwiZmxlZXRzRnVuY3Rpb25cIiwge1xuICAgICAgICAgICAgZW50cnk6IFwibGliL2xhbWJkYXMvZmxlZXRzX2Z1bmN0aW9uL1wiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiRmxlZXRzIFJlc29sdmVyXCIsXG4gICAgICAgICAgICBpbmRleDogXCJpbmRleC5weVwiLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJsYW1iZGFfaGFuZGxlclwiLFxuICAgICAgICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIHJ1bnRpbWU6IHByb3BzLmxhbWJkYUNvbmZpZy5ydW50aW1lLFxuICAgICAgICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxuICAgICAgICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgICAgICAgYXJjaGl0ZWN0dXJlOiBwcm9wcy5sYW1iZGFDb25maWcuYXJjaGl0ZWN0dXJlLFxuICAgICAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICAgICAgICBpbWFnZTogcHJvcHMubGFtYmRhQ29uZmlnLmJ1bmRsaW5nSW1hZ2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyAgICAgICAgICAgIGxheWVyczogW2Jhc2Vfc3RhY2suX3Bvd2VydG9vbHNfbGF5ZXJdLCAgIC8vIFRPRE8gdW5jb21tZW50IHdoZW4gZml4ZWQgaW4gYmFzZSBzdGFja1xuICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICBcIkREQl9UQUJMRVwiOiBmbGVldHNfdGFibGUudGFibGVOYW1lLFxuICAgICAgICAgICAgICAgIFwidXNlcl9wb29sX2lkXCI6IHByb3BzLnVzZXJQb29sSWQsXG4gICAgICAgICAgICAgICAgXCJQT1dFUlRPT0xTX1NFUlZJQ0VfTkFNRVwiOiBcImZsZWV0c19yZXNvbHZlclwiLFxuICAgICAgICAgICAgICAgIFwiTE9HX0xFVkVMXCI6IHByb3BzLmxhbWJkYUNvbmZpZy5sYXllcnNDb25maWcucG93ZXJUb29sc0xvZ0xldmVsLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSlcblxuICAgICAgICBmbGVldHNfdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGZsZWV0c19oYW5kbGVyKVxuXG4gICAgICAgIC8vIERlZmluZSB0aGUgZGF0YSBzb3VyY2UgZm9yIHRoZSBBUElcbiAgICAgICAgY29uc3QgZmxlZXRzX2RhdGFfc291cmNlID0gcHJvcHMuYXBwc3luY0FwaS5hcGkuYWRkTGFtYmRhRGF0YVNvdXJjZShcbiAgICAgICAgICAgIFwiRmxlZXRzRGF0YVNvdXJjZVwiLCBmbGVldHNfaGFuZGxlclxuICAgICAgICApXG5cbiAgICAgICAgLy8gRGVmaW5lIEFQSSBTY2hlbWFcblxuICAgICAgICBjb25zdCBmbGVldHNfb2JqZWN0X1R5cGUgPSBuZXcgT2JqZWN0VHlwZShcbiAgICAgICAgICAgIFwiRmxlZXRcIiwge1xuICAgICAgICAgICAgZGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgICAgIFwiZmxlZXROYW1lXCI6IEdyYXBocWxUeXBlLnN0cmluZygpLFxuICAgICAgICAgICAgICAgIFwiZmxlZXRJZFwiOiBHcmFwaHFsVHlwZS5pZCgpLFxuICAgICAgICAgICAgICAgIFwiY3JlYXRlZEF0XCI6IEdyYXBocWxUeXBlLmF3c0RhdGVUaW1lKCksXG4gICAgICAgICAgICAgICAgXCJjYXJJZHNcIjogR3JhcGhxbFR5cGUuaWQoeyBpc0xpc3Q6IHRydWUgfSksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KVxuXG4gICAgICAgIHByb3BzLmFwcHN5bmNBcGkuc2NoZW1hLmFkZFR5cGUoZmxlZXRzX29iamVjdF9UeXBlKVxuXG4gICAgICAgIC8vIEZsZWV0IG1ldGhvZHNcbiAgICAgICAgcHJvcHMuYXBwc3luY0FwaS5zY2hlbWEuYWRkUXVlcnkoXG4gICAgICAgICAgICBcImdldEFsbEZsZWV0c1wiLFxuICAgICAgICAgICAgbmV3IFJlc29sdmFibGVGaWVsZCh7XG4gICAgICAgICAgICAgICAgcmV0dXJuVHlwZTogZmxlZXRzX29iamVjdF9UeXBlLmF0dHJpYnV0ZSh7IGlzTGlzdDogdHJ1ZSB9KSxcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlOiBmbGVldHNfZGF0YV9zb3VyY2UsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgKVxuICAgICAgICBwcm9wcy5hcHBzeW5jQXBpLnNjaGVtYS5hZGRNdXRhdGlvbihcbiAgICAgICAgICAgIFwiYWRkRmxlZXRcIixcbiAgICAgICAgICAgIG5ldyBSZXNvbHZhYmxlRmllbGQoe1xuICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJmbGVldE5hbWVcIjogR3JhcGhxbFR5cGUuc3RyaW5nKHsgaXNSZXF1aXJlZDogdHJ1ZSB9KSxcbiAgICAgICAgICAgICAgICAgICAgXCJjYXJJZHNcIjogR3JhcGhxbFR5cGUuc3RyaW5nKHsgaXNMaXN0OiB0cnVlIH0pLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmV0dXJuVHlwZTogZmxlZXRzX29iamVjdF9UeXBlLmF0dHJpYnV0ZSgpLFxuICAgICAgICAgICAgICAgIGRhdGFTb3VyY2U6IGZsZWV0c19kYXRhX3NvdXJjZSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICApXG4gICAgICAgIHByb3BzLmFwcHN5bmNBcGkuc2NoZW1hLmFkZFN1YnNjcmlwdGlvbihcbiAgICAgICAgICAgIFwib25BZGRlZEZsZWV0XCIsXG4gICAgICAgICAgICBuZXcgUmVzb2x2YWJsZUZpZWxkKHtcbiAgICAgICAgICAgICAgICByZXR1cm5UeXBlOiBmbGVldHNfb2JqZWN0X1R5cGUuYXR0cmlidXRlKCksXG4gICAgICAgICAgICAgICAgZGF0YVNvdXJjZTogcHJvcHMuYXBwc3luY0FwaS5ub25lRGF0YVNvdXJjZSxcbiAgICAgICAgICAgICAgICByZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiBhcHBzeW5jLk1hcHBpbmdUZW1wbGF0ZS5mcm9tU3RyaW5nKFxuICAgICAgICAgICAgICAgICAgICBge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ2ZXJzaW9uXCI6IFwiMjAxNy0wMi0yOFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJwYXlsb2FkXCI6ICR1dGlsLnRvSnNvbigkY29udGV4dC5hcmd1bWVudHMuZW50cnkpXG4gICAgICAgICAgICAgICAgICAgIH1gXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICByZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogYXBwc3luYy5NYXBwaW5nVGVtcGxhdGUuZnJvbVN0cmluZyhcbiAgICAgICAgICAgICAgICAgICAgXCIkdXRpbC50b0pzb24oJGNvbnRleHQucmVzdWx0KVwiXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBkaXJlY3RpdmVzOiBbRGlyZWN0aXZlLnN1YnNjcmliZShcImFkZEZsZWV0XCIpXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICApXG5cbiAgICAgICAgcHJvcHMuYXBwc3luY0FwaS5zY2hlbWEuYWRkTXV0YXRpb24oXG4gICAgICAgICAgICBcImRlbGV0ZUZsZWV0c1wiLFxuICAgICAgICAgICAgbmV3IFJlc29sdmFibGVGaWVsZCh7XG4gICAgICAgICAgICAgICAgYXJnczogeyBcImZsZWV0SWRzXCI6IEdyYXBocWxUeXBlLnN0cmluZyh7IGlzUmVxdWlyZWRMaXN0OiB0cnVlIH0pIH0sXG4gICAgICAgICAgICAgICAgcmV0dXJuVHlwZTogZmxlZXRzX29iamVjdF9UeXBlLmF0dHJpYnV0ZSh7IGlzTGlzdDogdHJ1ZSB9KSxcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlOiBmbGVldHNfZGF0YV9zb3VyY2UsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgKVxuICAgICAgICBwcm9wcy5hcHBzeW5jQXBpLnNjaGVtYS5hZGRTdWJzY3JpcHRpb24oXG4gICAgICAgICAgICBcIm9uRGVsZXRlZEZsZWV0c1wiLFxuICAgICAgICAgICAgbmV3IFJlc29sdmFibGVGaWVsZCh7XG4gICAgICAgICAgICAgICAgcmV0dXJuVHlwZTogZmxlZXRzX29iamVjdF9UeXBlLmF0dHJpYnV0ZSh7IGlzTGlzdDogdHJ1ZSB9KSxcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlOiBwcm9wcy5hcHBzeW5jQXBpLm5vbmVEYXRhU291cmNlLFxuICAgICAgICAgICAgICAgIHJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6IGFwcHN5bmMuTWFwcGluZ1RlbXBsYXRlLmZyb21TdHJpbmcoXG4gICAgICAgICAgICAgICAgICAgIGB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInZlcnNpb25cIjogXCIyMDE3LTAyLTI4XCIsXG4gICAgICAgICAgICAgICAgICAgIFwicGF5bG9hZFwiOiAkdXRpbC50b0pzb24oJGNvbnRleHQuYXJndW1lbnRzLmVudHJ5KVxuICAgICAgICAgICAgICAgICAgICB9YFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6IGFwcHN5bmMuTWFwcGluZ1RlbXBsYXRlLmZyb21TdHJpbmcoXG4gICAgICAgICAgICAgICAgICAgIFwiJHV0aWwudG9Kc29uKCRjb250ZXh0LnJlc3VsdClcIlxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgZGlyZWN0aXZlczogW0RpcmVjdGl2ZS5zdWJzY3JpYmUoXCJkZWxldGVGbGVldHNcIildLFxuICAgICAgICAgICAgfSksXG4gICAgICAgIClcblxuICAgICAgICBwcm9wcy5hcHBzeW5jQXBpLnNjaGVtYS5hZGRNdXRhdGlvbihcbiAgICAgICAgICAgIFwidXBkYXRlRmxlZXRcIixcbiAgICAgICAgICAgIG5ldyBSZXNvbHZhYmxlRmllbGQoe1xuICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJmbGVldElkXCI6IEdyYXBocWxUeXBlLnN0cmluZyh7IGlzUmVxdWlyZWQ6IHRydWUgfSksXG4gICAgICAgICAgICAgICAgICAgIFwiZmxlZXROYW1lXCI6IEdyYXBocWxUeXBlLnN0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICBcImNhcklkc1wiOiBHcmFwaHFsVHlwZS5pZCh7IGlzTGlzdDogdHJ1ZSB9KSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJldHVyblR5cGU6IGZsZWV0c19vYmplY3RfVHlwZS5hdHRyaWJ1dGUoKSxcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlOiBmbGVldHNfZGF0YV9zb3VyY2UsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgKVxuICAgICAgICBwcm9wcy5hcHBzeW5jQXBpLnNjaGVtYS5hZGRTdWJzY3JpcHRpb24oXG4gICAgICAgICAgICBcIm9uVXBkYXRlZEZsZWV0XCIsXG4gICAgICAgICAgICBuZXcgUmVzb2x2YWJsZUZpZWxkKHtcbiAgICAgICAgICAgICAgICByZXR1cm5UeXBlOiBmbGVldHNfb2JqZWN0X1R5cGUuYXR0cmlidXRlKCksXG4gICAgICAgICAgICAgICAgZGF0YVNvdXJjZTogcHJvcHMuYXBwc3luY0FwaS5ub25lRGF0YVNvdXJjZSxcbiAgICAgICAgICAgICAgICByZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiBhcHBzeW5jLk1hcHBpbmdUZW1wbGF0ZS5mcm9tU3RyaW5nKFxuICAgICAgICAgICAgICAgICAgICBge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ2ZXJzaW9uXCI6IFwiMjAxNy0wMi0yOFwiLFxuICAgICAgICAgICAgICAgICAgICBcInBheWxvYWRcIjogJHV0aWwudG9Kc29uKCRjb250ZXh0LmFyZ3VtZW50cy5lbnRyeSlcbiAgICAgICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICByZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogYXBwc3luYy5NYXBwaW5nVGVtcGxhdGUuZnJvbVN0cmluZyhcbiAgICAgICAgICAgICAgICBcIiR1dGlsLnRvSnNvbigkY29udGV4dC5yZXN1bHQpXCJcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBkaXJlY3RpdmVzOiBbRGlyZWN0aXZlLnN1YnNjcmliZShcInVwZGF0ZUZsZWV0XCIpXSxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgKVxuXG4gICAgICAgIC8vIEdyYW50IGFjY2VzcyBzbyBBUEkgbWV0aG9kcyBjYW4gYmUgaW52b2tlZFxuICAgICAgICBjb25zdCBhZG1pbl9hcGlfcG9saWN5ID0gbmV3IGlhbS5Qb2xpY3kodGhpcywgXCJhZG1pbkFwaVBvbGljeVwiLCB7XG4gICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcImFwcHN5bmM6R3JhcGhRTFwiXSxcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtwcm9wcy5hcHBzeW5jQXBpLmFwaS5hcm59L3R5cGVzL1F1ZXJ5L2ZpZWxkcy9nZXRBbGxGbGVldHNgLFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7cHJvcHMuYXBwc3luY0FwaS5hcGkuYXJufS90eXBlcy9NdXRhdGlvbi9maWVsZHMvYWRkRmxlZXRgLFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7cHJvcHMuYXBwc3luY0FwaS5hcGkuYXJufS90eXBlcy9TdWJzY3JpcHRpb24vZmllbGRzL2FkZGVkRmxlZXRgLFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7cHJvcHMuYXBwc3luY0FwaS5hcGkuYXJufS90eXBlcy9NdXRhdGlvbi9maWVsZHMvZGVsZXRlRmxlZXRgLFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7cHJvcHMuYXBwc3luY0FwaS5hcGkuYXJufS90eXBlcy9TdWJzY3JpcHRpb24vZmllbGRzL2RlbGV0ZWRGbGVldGAsXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtwcm9wcy5hcHBzeW5jQXBpLmFwaS5hcm59L3R5cGVzL011dGF0aW9uL2ZpZWxkcy91cGRhdGVGbGVldGAsXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtwcm9wcy5hcHBzeW5jQXBpLmFwaS5hcm59L3R5cGVzL1N1YnNjcmlwdGlvbi9maWVsZHMvYWRkZWRGbGVldGAsXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtwcm9wcy5hcHBzeW5jQXBpLmFwaS5hcm59L3R5cGVzL1N1YnNjcmlwdGlvbi9maWVsZHMvZGVsZXRlZEZsZWV0YCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke3Byb3BzLmFwcHN5bmNBcGkuYXBpLmFybn0vdHlwZXMvU3Vic2NyaXB0aW9uL2ZpZWxkcy91cGRhdGVkRmxlZXRgLFxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KVxuICAgICAgICBhZG1pbl9hcGlfcG9saWN5LmF0dGFjaFRvUm9sZShwcm9wcy5hZG1pbkdyb3VwUm9sZSlcblxufVxufVxuIl19