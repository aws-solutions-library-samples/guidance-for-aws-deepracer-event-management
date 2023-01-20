import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as awsEvents from 'aws-cdk-lib/aws-events';
import * as awsEventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as stepFunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepFunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { CodeFirstSchema, GraphqlType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';

import { Construct } from 'constructs';

export interface CarManagerProps {
    adminGroupRole: IRole;
    appsyncApi: {
        schema: CodeFirstSchema;
        api: appsync.IGraphqlApi;
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

export class CarManager extends Construct {
    constructor(scope: Construct, id: string, props: CarManagerProps) {
        super(scope, id);

        const carsTable = new dynamodb.Table(this, 'CarsStatusTable', {
            partitionKey: {
                name: 'InstanceId',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const carsTable_ping_state_index_name = 'pingStatus';
        carsTable.addGlobalSecondaryIndex({
            indexName: carsTable_ping_state_index_name,
            partitionKey: {
                name: 'PingStatus',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'InstanceId',
                type: dynamodb.AttributeType.STRING,
            },
        });

        const carStatusUpdateHandler = new lambdaPython.PythonFunction(
            this,
            'carStatusUpdateHandler',
            {
                entry: 'lib/lambdas/car_status_update_function',
                description: 'Car Status Updates',
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
                layers: [props.lambdaConfig.layersConfig.powerToolsLayer],
                environment: {
                    POWERTOOLS_SERVICE_NAME: 'car_status_update',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                    DDB_TABLE: carsTable.tableName,
                },
            }
        );

        carsTable.grantReadWriteData(carStatusUpdateHandler);

        carStatusUpdateHandler.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['ssm:ListTagsForResource'],
                resources: ['*'],
            })
        );

        const status_update_job = new stepFunctionsTasks.LambdaInvoke(this, 'Update Status', {
            lambdaFunction: carStatusUpdateHandler,
            outputPath: '$.Payload',
        });

        const describeInstanceInformationTask = new stepFunctionsTasks.CallAwsService(
            this,
            'DescribeInstanceInformation',
            {
                service: 'ssm',
                action: 'describeInstanceInformation',
                iamResources: ['*'],
                parameters: {
                    MaxResults: 50,
                    'NextToken.$': '$.NextToken',
                },
                resultPath: '$.Instances',
            }
        );

        const succeed_job = new stepFunctions.Succeed(this, 'Succeeded', {
            comment: 'AWS Batch Job succeeded',
        });

        const definition = describeInstanceInformationTask
            .next(status_update_job)
            .next(
                new stepFunctions.Choice(this, 'Job done?')
                    .when(
                        stepFunctions.Condition.isPresent('$.NextToken'),
                        describeInstanceInformationTask
                    )
                    .otherwise(succeed_job)
            );

        const car_status_update_SM = new stepFunctions.StateMachine(this, 'CarStatusUpdater', {
            definition: definition,
            timeout: Duration.minutes(3),
        });

        new awsEvents.Rule(this, 'CarStatusUpdateRule', {
            schedule: awsEvents.Schedule.rate(Duration.minutes(5)),
            targets: [
                new awsEventsTargets.SfnStateMachine(car_status_update_SM, {
                    input: awsEvents.RuleTargetInput.fromObject({ NextToken: '' }),
                    retryAttempts: 1,
                }),
            ],
        });

        // car_activation method
        const car_activation_handler = new lambdaPython.PythonFunction(
            this,
            'car_activation_handler',
            {
                entry: 'lib/lambdas/car_activation_function/',
                description: 'Car Activation',
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
                layers: [props.lambdaConfig.layersConfig.powerToolsLayer],

                environment: {
                    POWERTOOLS_SERVICE_NAME: 'car_activation',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                },
            }
        );

        car_activation_handler.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['iam:PassRole', 'ssm:AddTagsToResource', 'ssm:CreateActivation'],
                resources: ['*'],
            })
        );

        // Define the data source for the API
        const car_activation_data_source = props.appsyncApi.api.addLambdaDataSource(
            'car_activation_data_source',
            car_activation_handler
        );

        // Define API Schema
        const carActivationObjectType = new ObjectType('carActivation', {
            definition: {
                region: GraphqlType.string(),
                activationCode: GraphqlType.id(),
                activationId: GraphqlType.string(),
            },
        });

        props.appsyncApi.schema.addType(carActivationObjectType);

        // Event methods
        props.appsyncApi.schema.addMutation(
            'carActivation',
            new ResolvableField({
                args: {
                    hostname: GraphqlType.string({ isRequired: true }),
                    fleetId: GraphqlType.id({ isRequired: true }),
                    fleetName: GraphqlType.string({ isRequired: true }),
                },
                returnType: carActivationObjectType.attribute(),
                dataSource: car_activation_data_source,
            })
        );

        // cars_function_handler
        const cars_function_handler = new lambdaPython.PythonFunction(
            this,
            'cars_function_handler',
            {
                entry: 'lib/lambdas/cars_function/',
                description: 'Cars Function',
                index: 'index.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(5),
                runtime: props.lambdaConfig.runtime,
                tracing: lambda.Tracing.ACTIVE,
                memorySize: 128,
                architecture: props.lambdaConfig.architecture,
                bundling: { image: props.lambdaConfig.bundlingImage },
                layers: [props.lambdaConfig.layersConfig.powerToolsLayer],
                environment: {
                    POWERTOOLS_SERVICE_NAME: 'car_function',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                    DDB_TABLE: carsTable.tableName,
                    DDB_PING_STATE_INDEX: carsTable_ping_state_index_name,
                },
            }
        );

        cars_function_handler.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'ssm:DescribeInstanceInformation',
                    'ssm:ListTagsForResource',
                    'ssm:AddTagsToResource',
                    'ssm:RemoveTagsFromResource',
                    'ssm:SendCommand',
                    'ssm:GetCommandInvocation',
                ],
                resources: ['*'],
            })
        );

        carsTable.grantReadWriteData(cars_function_handler);

        // Define the data source for the API
        const cars_data_source = props.appsyncApi.api.addLambdaDataSource(
            'cars_data_source',
            cars_function_handler
        );

        // Define API Schema (returned data)
        const car_online_object_type = new ObjectType('carOnline', {
            definition: {
                InstanceId: GraphqlType.string(),
                PingStatus: GraphqlType.string(),
                LastPingDateTime: GraphqlType.string(),
                AgentVersion: GraphqlType.string(),
                IsLatestVersion: GraphqlType.boolean(),
                PlatformType: GraphqlType.string(),
                PlatformName: GraphqlType.string(),
                PlatformVersion: GraphqlType.string(),
                ActivationId: GraphqlType.id(),
                IamRole: GraphqlType.string(),
                RegistrationDate: GraphqlType.string(),
                ResourceType: GraphqlType.string(),
                Name: GraphqlType.string(),
                IpAddress: GraphqlType.string(),
                ComputerName: GraphqlType.string(),
                // "SourceId": GraphqlType.string(),
                // "SourceType": GraphqlType.string(),
                fleetId: GraphqlType.id(),
                fleetName: GraphqlType.string(),
            },
        });

        props.appsyncApi.schema.addType(car_online_object_type);

        // Event methods (input data)
        props.appsyncApi.schema.addQuery(
            'carsOnline',
            new ResolvableField({
                args: {
                    online: GraphqlType.boolean({ isRequired: true }),
                },
                returnType: car_online_object_type.attribute({ isList: true }),
                dataSource: cars_data_source,
            })
        );

        props.appsyncApi.schema.addMutation(
            'carUpdates',
            new ResolvableField({
                args: {
                    resourceIds: GraphqlType.string({
                        isList: true,
                        isRequired: true,
                    }),
                    fleetId: GraphqlType.string({ isRequired: true }),
                    fleetName: GraphqlType.string({ isRequired: true }),
                },
                returnType: GraphqlType.awsJson(),
                dataSource: cars_data_source,
            })
        );

        props.appsyncApi.schema.addMutation(
            'carDeleteAllModels',
            new ResolvableField({
                args: {
                    resourceIds: GraphqlType.string({ isList: true, isRequired: true }),
                },
                returnType: GraphqlType.awsJson(),
                dataSource: cars_data_source,
            })
        );

        props.appsyncApi.schema.addMutation(
            'carSetTaillightColor',
            new ResolvableField({
                args: {
                    resourceIds: GraphqlType.string({ isList: true, isRequired: true }),
                    selectedColor: GraphqlType.string({ isList: false, isRequired: true }),
                },
                returnType: GraphqlType.awsJson(),
                dataSource: cars_data_source,
            })
        );

        props.appsyncApi.schema.addQuery(
            'availableTaillightColors',
            new ResolvableField({
                returnType: GraphqlType.awsJson(),
                dataSource: cars_data_source,
            })
        );

        // All Methods...
        // Grant access so API methods can be invoked
        const admin_api_policy = new iam.Policy(this, 'adminApiPolicy', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['appsync:GraphQL'],
                    resources: [
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/carActivation`,
                        `${props.appsyncApi.api.arn}/types/Query/fields/carsOnline`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/carUpdates`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/carDeleteAllModels`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/carSetTaillightColor`,
                        `${props.appsyncApi.api.arn}/types/Query/fields/availableTaillightColors`,
                    ],
                }),
            ],
        });
        admin_api_policy.attachToRole(props.adminGroupRole);
    }
}
