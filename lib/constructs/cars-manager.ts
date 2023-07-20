import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as awsEvents from 'aws-cdk-lib/aws-events';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import * as awsEventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ManagedPolicy, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as stepFunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepFunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import {
    CodeFirstSchema,
    Directive,
    GraphqlType,
    ObjectType,
    ResolvableField,
} from 'awscdk-appsync-utils';

import { Construct } from 'constructs';

export interface CarManagerProps {
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
    eventbus: EventBus;
}

export class CarManager extends Construct {
    public readonly carStatusDataHandlerLambda: lambdaPython.PythonFunction;

    constructor(scope: Construct, id: string, props: CarManagerProps) {
        super(scope, id);

        const carStatusTable = new dynamodb.Table(this, 'CarsStatusTable', {
            partitionKey: {
                name: 'InstanceId',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const carsTable_ping_state_index_name = 'pingStatus';
        carStatusTable.addGlobalSecondaryIndex({
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
                    DDB_TABLE: carStatusTable.tableName,
                },
            }
        );

        carStatusTable.grantReadWriteData(carStatusUpdateHandler);

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

        // Define role used by lib/lambdas/car_activation_function/index.py
        const smmRunCommandRole = new iam.Role(
            this,
            'RoleAmazonEC2RunCommandRoleForManagedInstances',
            {
                assumedBy: new ServicePrincipal('ssm.amazonaws.com'),
                description: 'EC2 role for SSM',
                managedPolicies: [
                    ManagedPolicy.fromManagedPolicyArn(
                        this,
                        'PolicyAmazonSSMManagedInstanceCore',
                        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'
                    ),
                    ManagedPolicy.fromManagedPolicyArn(
                        this,
                        'AmazonSSMDirectoryServiceAccess',
                        'arn:aws:iam::aws:policy/AmazonSSMDirectoryServiceAccess'
                    ),
                ],
            }
        );

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
                    HYBRID_ACTIVATION_IAM_ROLE_NAME: smmRunCommandRole.roleName,
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

        // car_activation_clean method - clean up unactivated and expired hybrid activations
        const car_activation_clean_handler = new lambdaPython.PythonFunction(
            this,
            'car_activation_clean_handler',
            {
                entry: 'lib/lambdas/car_activation_clean/',
                description: 'Car Activation clean up unused activations',
                index: 'index.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(2),
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
                    POWERTOOLS_SERVICE_NAME: 'car_activation_clean',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                },
            }
        );

        new awsEvents.Rule(this, 'car_activation_clean_handler_cron', {
            schedule: awsEvents.Schedule.cron({ minute: '0', hour: '1' }),
            targets: [new awsEventsTargets.LambdaFunction(car_activation_clean_handler)],
        });

        car_activation_clean_handler.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['ssm:DeleteActivation', 'ssm:DescribeActivations'],
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
                    carUiPassword: GraphqlType.string({ isRequired: true }),
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
                    DDB_TABLE: carStatusTable.tableName,
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

        carStatusTable.grantReadWriteData(cars_function_handler);

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
            directives: [Directive.cognito('admin', 'operator')],
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
                directives: [Directive.cognito('admin', 'operator')],
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
                directives: [Directive.cognito('admin', 'operator')],
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
                directives: [Directive.cognito('admin', 'operator')],
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
                directives: [Directive.cognito('admin', 'operator')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'carEmergencyStop',
            new ResolvableField({
                args: {
                    resourceIds: GraphqlType.string({ isList: true, isRequired: true }),
                },
                returnType: GraphqlType.awsJson(),
                dataSource: cars_data_source,
                directives: [Directive.cognito('admin', 'operator')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'carRestartService',
            new ResolvableField({
                args: {
                    resourceIds: GraphqlType.string({ isList: true, isRequired: true }),
                },
                returnType: GraphqlType.awsJson(),
                dataSource: cars_data_source,
                directives: [Directive.cognito('admin', 'operator')],
            })
        );

        props.appsyncApi.schema.addQuery(
            'availableTaillightColors',
            new ResolvableField({
                returnType: GraphqlType.awsJson(),
                dataSource: cars_data_source,
                directives: [Directive.cognito('admin', 'operator')],
            })
        );

        // All Methods...

        // respond to Event Bridge user events
        const car_event_handler = new lambdaPython.PythonFunction(this, 'cars_event_handler', {
            entry: 'lib/lambdas/cars_function/',
            description: 'Work with Cognito users',
            index: 'eventbus_events.py',
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
                POWERTOOLS_SERVICE_NAME: 'car_function',
                LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                DDB_TABLE: carStatusTable.tableName,
                DDB_PING_STATE_INDEX: carsTable_ping_state_index_name,
            },
        });

        car_event_handler.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['ssm:AddTagsToResource', 'ssm:RemoveTagsFromResource'],
                resources: ['*'],
            })
        );

        carStatusTable.grantReadWriteData(car_event_handler);

        // EventBridge Rule
        const rule = new Rule(this, 'car_event_handler_rule', {
            eventBus: props.eventbus,
        });
        rule.addEventPattern({
            source: ['fleets'],
            detailType: ['carsUpdate'],
        });
        rule.addTarget(new awsEventsTargets.LambdaFunction(car_event_handler));

        // data fetching lambda for label printing
        const labelPrinterDataFetchHandler = new lambdaPython.PythonFunction(
            this,
            'labelPrinterDataFetchHandler',
            {
                entry: 'lib/lambdas/get_data_for_label_printing',
                description: 'Serves data needed for label printing',
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
                    POWERTOOLS_SERVICE_NAME: 'labelPrinterDataFetchHandler',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                    DDB_TABLE: carStatusTable.tableName,
                },
            }
        );

        this.carStatusDataHandlerLambda = labelPrinterDataFetchHandler;

        carStatusTable.grantReadData(labelPrinterDataFetchHandler);
    }
}
