import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
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

export interface RaceManagerProps {
    adminGroupRole: IRole;
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
    eventbus: EventBus;
}

export class RaceManager extends Construct {
    public readonly distribution: Distribution;
    public readonly websiteBucket: Bucket;

    constructor(scope: Construct, id: string, props: RaceManagerProps) {
        super(scope, id);

        const noneDataSource = props.appsyncApi.noneDataSource;

        // STORAGE
        const raceTable = new dynamodb.Table(this, 'Table', {
            partitionKey: {
                name: 'eventId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
        });

        // BACKEND
        const raceLambda = new lambdaPython.PythonFunction(this, 'raceLambda', {
            entry: 'lib/lambdas/race_api/',
            description: 'Race handler',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            bundling: {
                image: props.lambdaConfig.bundlingImage,
            },
            layers: [
                props.lambdaConfig.layersConfig.helperFunctionsLayer,
                props.lambdaConfig.layersConfig.powerToolsLayer,
            ],
            environment: {
                DDB_TABLE: raceTable.tableName,
                APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
                EVENT_BUS_NAME: props.eventbus.eventBusName,
            },
        });
        raceTable.grantReadWriteData(raceLambda);
        props.eventbus.grantPutEventsTo(raceLambda);
        props.appsyncApi.api.grantMutation(raceLambda, 'addLeaderboardEntry');

        const raceDataSource = props.appsyncApi.api.addLambdaDataSource(
            'RaceDataSource',
            raceLambda
        );

        // TODO make least privilage
        const adminApiPolicy = new iam.Policy(this, 'adminApiPolicy', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['appsync:GraphQL'],
                    resources: [`${props.appsyncApi.api.arn}/*`],
                }),
            ],
        });
        adminApiPolicy.attachToRole(props.adminGroupRole);

        // API Schema
        const lapObjectType = new ObjectType('Lap', {
            definition: {
                lapId: GraphqlType.id(),
                // raceId: GraphqlType.id(),
                // modelId: GraphqlType.id(),
                // carId: GraphqlType.id(),
                time: GraphqlType.float(),
                resets: GraphqlType.int(),
                // crashes: GraphqlType.int(),
                isValid: GraphqlType.boolean(),
                autTimerConnected: GraphqlType.boolean(),
            },
        });

        const lapInputObjectType = new InputType('LapInput', {
            definition: {
                lapId: GraphqlType.id(),
                // raceId: GraphqlType.id(),
                // trackId: GraphqlType.int(),
                // modelId: GraphqlType.id(),
                // carId: GraphqlType.id(),
                time: GraphqlType.float(),
                resets: GraphqlType.int(),
                // crashes: GraphqlType.int(),
                isValid: GraphqlType.boolean(),
                autTimerConnected: GraphqlType.boolean(),
            },
        });

        props.appsyncApi.schema.addType(lapObjectType);
        props.appsyncApi.schema.addType(lapInputObjectType);

        const raceObjectType = new ObjectType('Race', {
            definition: {
                eventId: GraphqlType.id({ isRequired: true }),
                trackId: GraphqlType.id({ isRequired: true }),
                userId: GraphqlType.id({ isRequired: true }),
                racedByProxy: GraphqlType.boolean({ isRequired: true }),
                raceId: GraphqlType.id({ isRequired: true }),
                createdAt: GraphqlType.awsDateTime(),
                laps: lapObjectType.attribute({ isList: true }),
            },
        });

        props.appsyncApi.schema.addType(raceObjectType);

        const raceDeleteInputType = new InputType('RaceDeleteInput', {
            definition: {
                userId: GraphqlType.id({ isRequired: true }),
                raceId: GraphqlType.id({ isRequired: true }),
            },
        });

        props.appsyncApi.schema.addType(raceDeleteInputType);

        const raceDeleteObjectType = new ObjectType('RaceDeleteObject', {
            definition: {
                eventId: GraphqlType.id({ isRequired: true }),
                trackId: GraphqlType.id({ isRequired: true }),
                raceIds: GraphqlType.id({ isList: true }),
            },
        });

        props.appsyncApi.schema.addType(raceDeleteObjectType);

        props.appsyncApi.schema.addMutation(
            'addRace',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                    trackId: GraphqlType.id({ isRequired: true }),
                    userId: GraphqlType.id({ isRequired: true }),
                    racedByProxy: GraphqlType.boolean({ isRequired: true }),
                    laps: lapInputObjectType.attribute({ isRequiredList: true }),
                },
                returnType: raceObjectType.attribute(),
                dataSource: raceDataSource,
            })
        );

        props.appsyncApi.schema.addSubscription(
            'onAddedRace',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                    trackId: GraphqlType.id(),
                },
                returnType: raceObjectType.attribute(),
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
                directives: [Directive.subscribe('addRace')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'updateRace',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                    raceId: GraphqlType.id({ isRequired: true }),
                    trackId: GraphqlType.id({ isRequired: true }),
                    userId: GraphqlType.id({ isRequired: true }),
                    racedByProxy: GraphqlType.boolean({ isRequired: true }),
                    laps: lapInputObjectType.attribute({ isRequiredList: true }),
                },
                returnType: raceObjectType.attribute(),
                dataSource: raceDataSource,
            })
        );

        props.appsyncApi.schema.addMutation(
            'deleteRaces',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                    trackId: GraphqlType.id({ isRequired: true }),
                    racesToDelete: raceDeleteInputType.attribute({ isRequiredList: true }),
                },
                returnType: raceDeleteObjectType.attribute(),
                dataSource: raceDataSource,
            })
        );

        props.appsyncApi.schema.addSubscription(
            'onDeletedRaces',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                    trackId: GraphqlType.id(),
                },
                returnType: raceDeleteObjectType.attribute(),
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
                directives: [Directive.subscribe('deleteRaces')],
            })
        );

        // Event Admin methods
        props.appsyncApi.schema.addQuery(
            'getRaces',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.string({ isRequired: true }),
                    userId: GraphqlType.string(),
                },
                returnType: raceObjectType.attribute({ isList: true }),
                dataSource: raceDataSource,
            })
        );

        // OVERLAY METHODS
        const raceStatusEnum = new EnumType('RaceStatusEnum', {
            definition: [
                'NO_RACER_SELECTED',
                'READY_TO_START',
                'RACE_IN_PROGRESS',
                'RACE_PAUSED',
                'RACE_FINSIHED',
            ],
        });
        props.appsyncApi.schema.addType(raceStatusEnum);

        // broadcast Overlays
        const overlayObjectType = new ObjectType('Overlay', {
            definition: {
                eventId: GraphqlType.id({ isRequired: true }),
                eventName: GraphqlType.string(),
                trackId: GraphqlType.id(),
                username: GraphqlType.string(),
                userId: GraphqlType.string(),
                laps: lapObjectType.attribute({ isList: true }),
                timeLeftInMs: GraphqlType.float(),
                currentLapTimeInMs: GraphqlType.float(),
                raceStatus: raceStatusEnum.attribute({ isRequired: true }),
            },
            directives: [Directive.apiKey(), Directive.iam()],
        });

        props.appsyncApi.schema.addType(overlayObjectType);

        props.appsyncApi.schema.addMutation(
            'updateOverlayInfo',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                    eventName: GraphqlType.string(),
                    trackId: GraphqlType.id(),
                    username: GraphqlType.string(),
                    userId: GraphqlType.string(),
                    laps: lapInputObjectType.attribute({ isList: true }),
                    timeLeftInMs: GraphqlType.float(),
                    currentLapTimeInMs: GraphqlType.float(),
                    raceStatus: raceStatusEnum.attribute({ isRequired: true }),
                },
                returnType: overlayObjectType.attribute(),
                dataSource: noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
            })
        );

        props.appsyncApi.schema.addSubscription(
            'onNewOverlayInfo',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                    trackId: GraphqlType.id(),
                },
                returnType: overlayObjectType.attribute(),
                dataSource: noneDataSource,
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
                    Directive.subscribe('updateOverlayInfo'),
                    Directive.apiKey(),
                    Directive.iam(),
                ],
            })
        );
    }
}
