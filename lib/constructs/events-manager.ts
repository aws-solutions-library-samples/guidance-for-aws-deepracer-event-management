
import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { CodeFirstSchema, Directive, GraphqlType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';


import { Construct } from 'constructs';

export interface EventsManagerProps {
    adminGroupRole: IRole,
    userPoolId: string,
    appsyncApi: {
        schema: CodeFirstSchema,
        api: appsync.IGraphqlApi
        noneDataSource: appsync.NoneDataSource
    },
    lambdaConfig: {
        runtime: lambda.Runtime,
        architecture: lambda.Architecture,
        bundlingImage: DockerImage
        layersConfig: {
            powerToolsLogLevel: string
            helperFunctionsLayer: lambda.ILayerVersion
            powerToolsLayer: lambda.ILayerVersion
        }
    }

}

export class EventsManager extends Construct {
    constructor(scope: Construct, id: string, props: EventsManagerProps) {
        super(scope, id);

        const events_table = new dynamodb.Table(
            this,
            "EventsTable", {
            partitionKey: {
                name: "eventId", type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
        })

        const events_handler = new lambdaPython.PythonFunction(this, "eventsFunction", {
            entry: "lib/lambdas/events_function/",
            description: "Events Resolver",
            index: "index.py",
            handler: "lambda_handler",
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            bundling: { image: props.lambdaConfig.bundlingImage },
            layers: [

                props.lambdaConfig.layersConfig.powerToolsLayer
            ],

            environment: {
                "DDB_TABLE": events_table.tableName,
                "user_pool_id": props.userPoolId,
                "POWERTOOLS_SERVICE_NAME": "events_resolver",
                "LOG_LEVEL": props.lambdaConfig.layersConfig.powerToolsLogLevel,
            },
        })

        events_table.grantReadWriteData(events_handler)

        // Define the data source for the API
        const events_data_source = props.appsyncApi.api.addLambdaDataSource(
            "EventsDataSource", events_handler
        )

        // Define API Schema

        const events_object_Type = new ObjectType(
            "Event", {
            definition: {
                "eventId": GraphqlType.id(),
                "createdAt": GraphqlType.awsDateTime(),
                "eventName": GraphqlType.string(),
                "eventDate": GraphqlType.awsDate(),
                "fleetId": GraphqlType.id(),
                "countryCode": GraphqlType.string(),
                "raceRankingMethod": GraphqlType.string(),
                "raceTimeInMin": GraphqlType.int(),
                "raceNumberOfResets": GraphqlType.int(),
                "raceLapsToFinish": GraphqlType.int(),
                "raceTrackType": GraphqlType.string(),
            },
        })

        props.appsyncApi.schema.addType(events_object_Type)

        // Event methods
        props.appsyncApi.schema.addQuery(
            "getAllEvents",
            new ResolvableField({
                returnType: events_object_Type.attribute({ isList: true }),
                dataSource: events_data_source,
            }))

        props.appsyncApi.schema.addMutation(
            "addEvent",
            new ResolvableField({
                args: {
                    "eventName": GraphqlType.string({ isRequired: true }),
                    "eventDate": GraphqlType.awsDate(),
                    "fleetId": GraphqlType.id(),
                    "countryCode": GraphqlType.string(),
                    "raceRankingMethod": GraphqlType.string({ isRequired: true }),
                    "raceTimeInMin": GraphqlType.int({ isRequired: true }),
                    "raceNumberOfResets": GraphqlType.int({ isRequired: true }),
                    "raceLapsToFinish": GraphqlType.int({ isRequired: true }),
                    "raceTrackType": GraphqlType.string({ isRequired: true }),
                },
                returnType: events_object_Type.attribute(),
                dataSource: events_data_source,
            }),
        )
        props.appsyncApi.schema.addSubscription(
            "onAddedEvent",
            new ResolvableField({
                returnType: events_object_Type.attribute(),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                    "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString
                    (
                        "$util.toJson($context.result)"
                    ),
                directives: [Directive.subscribe("addEvent")],
            }),
        )

        props.appsyncApi.schema.addMutation(
            "deleteEvents",
            new ResolvableField({
                args: { "eventIds": GraphqlType.string({ isRequiredList: true }) },
                returnType: events_object_Type.attribute({ isList: true }),
                dataSource: events_data_source,
            }),
        )
        props.appsyncApi.schema.addSubscription(
            "onDeletedEvents",
            new ResolvableField({
                returnType: events_object_Type.attribute({ isList: true }),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    "$util.toJson($context.result)"
                ),
                directives: [Directive.subscribe("deleteEvents")],
            }),
        )

        props.appsyncApi.schema.addMutation(
            "updateEvent",
            new ResolvableField({
                args: {
                    "eventId": GraphqlType.string({ isRequired: true }),
                    "eventName": GraphqlType.string(),
                    "eventDate": GraphqlType.awsDate(),
                    "fleetId": GraphqlType.id(),
                    "countryCode": GraphqlType.string(),
                    "raceTrackType": GraphqlType.string(),
                    "raceRankingMethod": GraphqlType.string(),
                    "raceTimeInMin": GraphqlType.int(),
                    "raceNumberOfResets": GraphqlType.int(),
                    "raceLapsToFinish": GraphqlType.int(),
                },
                returnType: events_object_Type.attribute(),
                dataSource: events_data_source,
            }),
        )
        props.appsyncApi.schema.addSubscription(
            "onUpdatedEvent",
            new ResolvableField({
                returnType: events_object_Type.attribute(),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                    "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    "$util.toJson($context.result)"
                ),
                directives: [Directive.subscribe("updateEvent")],
            }),
        )

        // // Grant access so API methods can be invoked
        // for role in roles_to_grant_invoke_access:

        const admin_api_policy = new iam.Policy(this, "eventsManagerAdminApiPolicy", {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ["appsync:GraphQL"],
                    resources: [
                        `${props.appsyncApi.api.arn}/types/Query/fields/getAllEvents`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/addEvent`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/addedEvent`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/deleteEvent`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/deletedEvent`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/updateEvent`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/addedEvent`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/deletedEvent`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/updatedEvent`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/addTrack`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/deleteTrack`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/updateTrack`,
                    ],
                })
            ],
        })
        admin_api_policy.attachToRole(props.adminGroupRole)
    }
}