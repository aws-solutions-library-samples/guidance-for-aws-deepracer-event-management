import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {
    CodeFirstSchema,
    Directive,
    GraphqlType,
    InputType,
    ObjectType,
    ResolvableField,
} from 'awscdk-appsync-utils';

import { Construct } from 'constructs';

export interface LeaderboardProps {
    adminGroupRole: IRole;
    userPoolId: string;
    userPoolArn: string;
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
}

export class Leaderboard extends Construct {
    constructor(scope: Construct, id: string, props: LeaderboardProps) {
        super(scope, id);

        const laps_table = new dynamodb.Table(this, 'Table', {
            partitionKey: {
                name: 'pk',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
        });

        const laps_lambda = new lambdaPython.PythonFunction(this, 'leaderboard_laps_lambda', {
            entry: 'lib/lambdas/leaderboard_laps_lambda/',
            description: 'Race Laps handler',
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
                DDB_TABLE: laps_table.tableName,
                APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
                user_pool_id: props.userPoolId,
            },
        });
        laps_table.grantReadWriteData(laps_lambda);
        props.appsyncApi.api.grantMutation(laps_lambda, 'newFastestLapForUser');

        laps_lambda.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:ListUsers'],
                resources: [props.userPoolArn],
            })
        );

        const laps_data_source = props.appsyncApi.api.addLambdaDataSource(
            'lapsDataSource',
            laps_lambda
        );
        const none_data_source = props.appsyncApi.noneDataSource;

        const admin_api_policy = new iam.Policy(this, 'adminApiPolicy', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['appsync:GraphQL'],
                    resources: [`${props.appsyncApi.api.arn}/*`],
                }),
            ],
        });
        admin_api_policy.attachToRole(props.adminGroupRole);

        // TODO part of overlay
        // const unauth_user_policy = new iam.Policy(this, "unAuthUserApiPolicy", {
        //     statements:[
        //         new iam.PolicyStatement({
        //             effect : iam.Effect.ALLOW,
        //             actions :["appsync:GraphQL"],
        //             resources :[`${props.appsyncApi.api.arn}/types/Subscription/fields/onNewOverlayInfo`],
        //         })
        //     ],
        // })
        //  unauth_user_policy.attachToRole(base_stack.idp.unauthenticated_user_role)

        // Leader board
        // Define API Schema
        const user_object_type = new ObjectType('User', {
            definition: {
                username: GraphqlType.string(),
                email: GraphqlType.string(),
            },
        });

        props.appsyncApi.schema.addType(user_object_type);

        const lap_object_type = new ObjectType('Lap', {
            definition: {
                id: GraphqlType.id(),
                raceId: GraphqlType.id(),
                modelId: GraphqlType.id(),
                carId: GraphqlType.id(),
                time: GraphqlType.float(),
                resets: GraphqlType.int(),
                crashes: GraphqlType.int(),
                isValid: GraphqlType.boolean(),
                autTimerConnected: GraphqlType.boolean(),
            },
        });

        const lap_input_object_type = new InputType('LapInput', {
            definition: {
                id: GraphqlType.id(),
                raceId: GraphqlType.id(),
                modelId: GraphqlType.id(),
                carId: GraphqlType.id(),
                time: GraphqlType.float(),
                resets: GraphqlType.int(),
                crashes: GraphqlType.int(),
                isValid: GraphqlType.boolean(),
                autTimerConnected: GraphqlType.boolean(),
            },
        });

        props.appsyncApi.schema.addType(lap_object_type);
        props.appsyncApi.schema.addType(lap_input_object_type);

        const race_object_type = new ObjectType('Race', {
            definition: {
                id: GraphqlType.id(),
                username: GraphqlType.string(),
                laps: lap_object_type.attribute({ isList: true }),
            },
        });

        props.appsyncApi.schema.addType(race_object_type);

        // TimeKeeper methods
        props.appsyncApi.schema.addQuery(
            'getAllRacers',
            new ResolvableField({
                returnType: user_object_type.attribute({ isList: true }),
                dataSource: laps_data_source,
            })
        );
        props.appsyncApi.schema.addMutation(
            'addRace',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                    username: GraphqlType.string({ isRequired: true }),
                    laps: lap_input_object_type.attribute({ isRequiredList: true }),
                },
                returnType: race_object_type.attribute(),
                dataSource: laps_data_source,
            })
        );

        // Leaderboard methds
        const leaderboardentry_object_type = new ObjectType('LeaderBoardEntry', {
            definition: {
                username: GraphqlType.string(),
                eventId: GraphqlType.string(),
                time: GraphqlType.float(),
            },
        });

        props.appsyncApi.schema.addType(leaderboardentry_object_type);

        props.appsyncApi.schema.addQuery(
            'getLeaderBoardEntries',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                },
                returnType: leaderboardentry_object_type.attribute({ isList: true }),
                dataSource: laps_data_source,
            })
        );

        props.appsyncApi.schema.addMutation(
            'newFastestLapForUser',
            new ResolvableField({
                args: {
                    username: GraphqlType.string({ isRequired: true }),
                    time: GraphqlType.float({ isRequired: true }),
                    eventId: GraphqlType.id({ isRequired: true }),
                },
                returnType: leaderboardentry_object_type.attribute(),
                dataSource: none_data_source,
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
            'onNewFastestLapForUser',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id(),
                },
                returnType: leaderboardentry_object_type.attribute(),
                dataSource: none_data_source,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                    "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
                directives: [Directive.subscribe('newFastestLapForUser')],
            })
        );

        // Event Admin methods
        props.appsyncApi.schema.addQuery(
            'getRacesForUser',
            new ResolvableField({
                args: {
                    username: GraphqlType.string({ isRequired: true }),
                    eventId: GraphqlType.string({ isRequired: true }),
                },
                returnType: race_object_type.attribute({ isList: true }),
                dataSource: laps_data_source,
            })
        );

        // broadcast Overlays
        const overlay_object_type = new ObjectType('Overlay', {
            definition: {
                eventId: GraphqlType.string({ isRequired: true }),
                username: GraphqlType.string({ isRequired: true }),
                timeLeftInMs: GraphqlType.float({ isRequired: true }),
                currentLapTimeInMs: GraphqlType.float({ isRequired: true }),
            },
        });

        props.appsyncApi.schema.addType(overlay_object_type);

        props.appsyncApi.schema.addMutation(
            'updateOverlayInfo',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.string({ isRequired: true }),
                    username: GraphqlType.string({ isRequired: true }),
                    timeLeftInMs: GraphqlType.float({ isRequired: true }),
                    currentLapTimeInMs: GraphqlType.float({ isRequired: true }),
                },
                returnType: overlay_object_type.attribute(),
                dataSource: none_data_source,
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
                // args:{
                //     "eventId": GraphqlType.id({isRequired: true}),
                // },
                returnType: overlay_object_type.attribute(),
                dataSource: none_data_source,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
                directives: [Directive.subscribe('updateOverlayInfo')],
            })
        );
    }
}
