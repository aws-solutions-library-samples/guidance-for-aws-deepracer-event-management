import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import {
    CodeFirstSchema,
    Directive,
    EnumType,
    GraphqlType,
    InputType,
    ObjectType,
    ResolvableField,
} from 'awscdk-appsync-utils';

import { Construct } from 'constructs';

export interface EventsManagerProps {
    appsyncApi: {
        schema: CodeFirstSchema;
        api: appsync.GraphqlApi;
        noneDataSource: appsync.NoneDataSource;
    };
    lambdaConfig: {
        runtime: lambda.Runtime;
        architecture: lambda.Architecture;
        bundlingImage: DockerImage;
        layersConfig: {
            powerToolsLogLevel: string;
            helperFunctionsLayer: lambda.ILayerVersion;
            powerToolsLayer: lambda.ILayerVersion;
        };
    };
    leaderboardApi: {
        leaderboardConfigObjectType: ObjectType;
        leaderboardConfigInputype: InputType;
    };
    eventbus: EventBus;
}
export class EventsManager extends Construct {
    constructor(scope: Construct, id: string, props: EventsManagerProps) {
        super(scope, id);

        const stack = Stack.of(this);

        const eventsTable = new dynamodb.Table(this, 'EventsTable', {
            partitionKey: {
                name: 'eventId',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
            stream: dynamodb.StreamViewType.NEW_IMAGE,
        });

        const ddbstreamToEventBridgeFunction = new lambdaPython.PythonFunction(
            this,
            'ddbStreamToEvbFunction',
            {
                entry: 'lib/lambdas/events_ddb_stream_to_evb_function/',
                description: 'Events - DDB stream to EVB',
                index: 'index.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(1),
                runtime: props.lambdaConfig.runtime,
                tracing: lambda.Tracing.ACTIVE,
                memorySize: 128,
                bundling: { image: props.lambdaConfig.bundlingImage },
                layers: [props.lambdaConfig.layersConfig.powerToolsLayer],

                environment: {
                    EVENT_BUS_NAME: props.eventbus.eventBusName,
                    POWERTOOLS_SERVICE_NAME: 'events_ddb_stream_to_evb',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                },
            }
        );
        props.eventbus.grantPutEventsTo(ddbstreamToEventBridgeFunction.grantPrincipal);
        ddbstreamToEventBridgeFunction.addEventSource(
            new DynamoEventSource(eventsTable, {
                startingPosition: StartingPosition.LATEST,
                batchSize: 1,
            })
        );

        const eventsFunction = new lambdaPython.PythonFunction(this, 'eventsFunction', {
            entry: 'lib/lambdas/events_api/',
            description: 'Events Resolver',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            bundling: { image: props.lambdaConfig.bundlingImage },
            layers: [props.lambdaConfig.layersConfig.powerToolsLayer],

            environment: {
                DDB_TABLE: eventsTable.tableName,
                POWERTOOLS_SERVICE_NAME: 'events_resolver',
                LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
            },
        });

        eventsTable.grantReadWriteData(eventsFunction);

        const eventsDataSourceDdb = props.appsyncApi.api.addDynamoDbDataSource(
            'EventsDataSourceDdb',
            eventsTable
        );
        eventsTable.grantReadWriteData(eventsDataSourceDdb);

        // Define the data source for the API
        const eventsDataSource = props.appsyncApi.api.addLambdaDataSource(
            'EventsDataSource',
            eventsFunction
        );

        // Define API Schema
        const trackTypeMethodEnum = new EnumType('TrackType', {
            definition: ['REINVENT_2018', 'REINVENT_2019', 'SUMMIT_SPEEDWAY', 'OTHER'],
        });
        props.appsyncApi.schema.addType(trackTypeMethodEnum);

        const raceRankingMethodEnum = new EnumType('RankingMethod', {
            definition: ['BEST_LAP_TIME'],
        });
        props.appsyncApi.schema.addType(raceRankingMethodEnum);

        const raceConfigObjectType = new ObjectType('RaceConfig', {
            definition: {
                raceTimeInMin: GraphqlType.int(),
                numberOfResetsPerLap: GraphqlType.int(),
                trackType: trackTypeMethodEnum.attribute(),
                rankingMethod: raceRankingMethodEnum.attribute(),
            },
            directives: [Directive.cognito('admin', 'commentator', 'operator')],
        });
        props.appsyncApi.schema.addType(raceConfigObjectType);

        const raceConfigInputType = new InputType('RaceInputConfig', {
            definition: {
                raceTimeInMin: GraphqlType.int(),
                numberOfResetsPerLap: GraphqlType.int(),
                trackType: trackTypeMethodEnum.attribute(),
                rankingMethod: raceRankingMethodEnum.attribute(),
            },
            directives: [Directive.cognito('admin', 'operator')],
        });
        props.appsyncApi.schema.addType(raceConfigInputType);

        const trackObjectType = new ObjectType('Track', {
            definition: {
                trackId: GraphqlType.id(),
                raceConfig: raceConfigObjectType.attribute(),
                leaderboardConfig: props.leaderboardApi.leaderboardConfigObjectType.attribute(),
            },
            directives: [Directive.cognito('admin', 'commentator', 'operator')],
        });
        props.appsyncApi.schema.addType(trackObjectType);

        const trackInputType = new InputType('TrackInput', {
            definition: {
                trackId: GraphqlType.id({ isRequired: true }),
                raceConfig: raceConfigInputType.attribute({ isRequired: true }),
                leaderboardConfig: props.leaderboardApi.leaderboardConfigInputype.attribute({
                    isRequired: true,
                }),
            },
            directives: [Directive.cognito('admin', 'operator')],
        });
        props.appsyncApi.schema.addType(trackInputType);

        const typeOfEventEnum = new EnumType('TypeOfEvent', {
            definition: [
                'PRIVATE_WORKSHOP',
                'PRIVATE_TRACK_RACE',
                'OFFICIAL_WORKSHOP',
                'OFFICIAL_TRACK_RACE',
                'OTHER',
            ],
        });
        props.appsyncApi.schema.addType(typeOfEventEnum);

        const eventObjectType = new ObjectType('Event', {
            definition: {
                eventId: GraphqlType.id(),
                createdAt: GraphqlType.awsDateTime(),
                createdBy: GraphqlType.id(),
                eventName: GraphqlType.string(),
                typeOfEvent: typeOfEventEnum.attribute({ isRequired: true }),
                eventDate: GraphqlType.awsDate(),
                fleetId: GraphqlType.id(),
                countryCode: GraphqlType.string(),
                tracks: trackObjectType.attribute({ isList: true }),
            },
            directives: [Directive.cognito('admin', 'operator', 'commentator', 'registration')],
        });

        props.appsyncApi.schema.addType(eventObjectType);

        // Event methods
        props.appsyncApi.schema.addQuery(
            'getEvents',
            new ResolvableField({
                returnType: eventObjectType.attribute({ isList: true }),
                dataSource: eventsDataSourceDdb,
                requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
                responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
                directives: [Directive.cognito('admin', 'operator', 'commentator', 'registration')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'addEvent',
            new ResolvableField({
                args: {
                    eventName: GraphqlType.string({ isRequired: true }),
                    createdBy: GraphqlType.id({ isRequired: true }),
                    typeOfEvent: typeOfEventEnum.attribute({ isRequired: true }),
                    tracks: trackInputType.attribute({ isRequiredList: true }),
                    eventDate: GraphqlType.awsDate(),
                    fleetId: GraphqlType.id(),
                    countryCode: GraphqlType.string(),
                },
                returnType: eventObjectType.attribute(),
                dataSource: eventsDataSourceDdb,
                requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
                    appsync.PrimaryKey.partition('eventId').auto(),
                    appsync.Values.projecting()
                ),
                responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
                directives: [Directive.cognito('admin', 'operator')],
            })
        );

        props.appsyncApi.schema.addSubscription(
            'onAddedEvent',
            new ResolvableField({
                returnType: eventObjectType.attribute(),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
                directives: [
                    Directive.subscribe('addEvent'),
                    Directive.cognito('admin', 'commentator', 'operator'),
                ],
            })
        );

        props.appsyncApi.schema.addMutation(
            'deleteEvents',
            new ResolvableField({
                args: { eventIds: GraphqlType.string({ isRequiredList: true }) },
                returnType: GraphqlType.awsJson({ isList: true }),
                dataSource: eventsDataSource,
                directives: [Directive.cognito('admin', 'operator')],
            })
        );
        props.appsyncApi.schema.addSubscription(
            'onDeletedEvents',
            new ResolvableField({
                returnType: GraphqlType.awsJson({ isList: true }),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
                directives: [
                    Directive.subscribe('deleteEvents'),
                    Directive.cognito('admin', 'operator'),
                ],
            })
        );

        props.appsyncApi.schema.addMutation(
            'updateEvent',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.string({ isRequired: true }),
                    eventName: GraphqlType.string({ isRequired: true }),
                    typeOfEvent: typeOfEventEnum.attribute({ isRequired: true }),
                    tracks: trackInputType.attribute({ isRequiredList: true }),
                    eventDate: GraphqlType.awsDate(),
                    fleetId: GraphqlType.id(),
                    countryCode: GraphqlType.string(),
                },
                returnType: eventObjectType.attribute(),
                dataSource: eventsDataSource,
                directives: [Directive.cognito('admin', 'operator')],
            })
        );
        props.appsyncApi.schema.addSubscription(
            'onUpdatedEvent',
            new ResolvableField({
                returnType: eventObjectType.attribute(),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
                directives: [
                    Directive.subscribe('updateEvent'),
                    Directive.cognito('admin', 'commentator', 'operator'),
                ],
            })
        );
    }
}
