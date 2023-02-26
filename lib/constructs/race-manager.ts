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
    GraphqlType,
    InputType,
    ObjectType,
    ResolvableField,
} from 'awscdk-appsync-utils';

import { Construct } from 'constructs';

export interface RaceManagerProps {
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
    eventbus: EventBus;
}

export class RaceManager extends Construct {
    public readonly distribution: Distribution;
    public readonly websiteBucket: Bucket;

    constructor(scope: Construct, id: string, props: RaceManagerProps) {
        super(scope, id);

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
                user_pool_id: props.userPoolId,
            },
        });
        raceTable.grantReadWriteData(raceLambda);
        props.eventbus.grantPutEventsTo(raceLambda);
        props.appsyncApi.api.grantMutation(raceLambda, 'addLeaderboardEntry');

        raceLambda.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:ListUsers'],
                resources: [props.userPoolArn],
            })
        );

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

        const lapInputObjectType = new InputType('LapInput', {
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

        props.appsyncApi.schema.addType(lapObjectType);
        props.appsyncApi.schema.addType(lapInputObjectType);

        const raceObjectType = new ObjectType('Race', {
            definition: {
                id: GraphqlType.id(),
                username: GraphqlType.string(),
                laps: lapObjectType.attribute({ isList: true }),
            },
        });

        props.appsyncApi.schema.addType(raceObjectType);

        props.appsyncApi.schema.addMutation(
            'addRace',
            new ResolvableField({
                args: {
                    eventId: GraphqlType.id({ isRequired: true }),
                    trackId: GraphqlType.id({ isRequired: true }),
                    userId: GraphqlType.id({ isRequired: true }),
                    username: GraphqlType.string({ isRequired: true }),
                    laps: lapInputObjectType.attribute({ isRequiredList: true }),
                },
                returnType: raceObjectType.attribute(),
                dataSource: raceDataSource,
            })
        );

        // Event Admin methods
        // props.appsyncApi.schema.addQuery(
        //     'getRacesForUser',
        //     new ResolvableField({
        //         args: {
        //             username: GraphqlType.string({ isRequired: true }),
        //             eventId: GraphqlType.string({ isRequired: true }),
        //         },
        //         returnType: raceObjectType.attribute({ isList: true }),
        //         dataSource: raceDataSource,
        //     })
        // );
    }
}
