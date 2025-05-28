import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as awsEvents from 'aws-cdk-lib/aws-events';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as awsEventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ManagedPolicy, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as stepFunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepFunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { CodeFirstSchema, Directive, GraphqlType, InputType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

import { Construct } from 'constructs';

export interface CarManagerProps {
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
      appsyncHelpersLayer: lambda.ILayerVersion;
    };
  };
  eventbus: EventBus;
}

export class CarManager extends Construct {
  public readonly carStatusDataHandlerLambda: lambdaPython.PythonFunction;

  constructor(scope: Construct, id: string, props: CarManagerProps) {
    super(scope, id);
    const stack = cdk.Stack.of(scope);

    const carStatusTable = new dynamodb.Table(this, 'CarsStatusTable', {
      partitionKey: {
        name: 'InstanceId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
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

    const carStatusUpdateHandler = new StandardLambdaPythonFunction(this, 'carStatusUpdateHandler', {
      entry: 'lib/lambdas/car_status_update_function',
      description: 'Car Status Updates',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
      ],
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_status_update',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
    });

    props.appsyncApi.api.grantMutation(carStatusUpdateHandler, 'carsUpdateStatus');

    const carStatusUpdateHandlerAdditionalRolePolicy = carStatusUpdateHandler.addAdditionalRolePolicy(
      'carStatusUpdateHandlerPolicy',
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:ListTagsForResource', 'ssm:ListInventoryEntries'],
        resources: ['*'],
      })
    );

    NagSuppressions.addResourceSuppressionsByPath(stack, carStatusUpdateHandlerAdditionalRolePolicy.resourcePath, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'ssm:ListTagsForResource and ssm:GetInventory allows lambda to read all the tags',
        appliesTo: ['Resource::*'],
      },
    ]);

    const status_update_job = new stepFunctionsTasks.LambdaInvoke(this, 'Update Status', {
      lambdaFunction: carStatusUpdateHandler,
      outputPath: '$.Payload',
    });

    const describeInstanceInformationTask = new stepFunctionsTasks.CallAwsService(this, 'DescribeInstanceInformation', {
      service: 'ssm',
      action: 'describeInstanceInformation',
      iamResources: ['*'],
      parameters: {
        MaxResults: 50,
        Filters: [
          {
            Key: 'tag:Type',
            Values: ['deepracer', 'timer'],
          },
        ],
        'NextToken.$': '$.NextToken',
      },
      resultPath: '$.Instances',
    });

    const succeed_job = new stepFunctions.Succeed(this, 'Succeeded', {
      comment: 'AWS Batch Job succeeded',
    });

    const definition = describeInstanceInformationTask
      .next(status_update_job)
      .next(
        new stepFunctions.Choice(this, 'Job done?')
          .when(stepFunctions.Condition.isPresent('$.NextToken'), describeInstanceInformationTask)
          .otherwise(succeed_job)
      );

    const car_status_update_SM_log_group = new logs.LogGroup(this, 'StatusSFN', {
      retention: logs.RetentionDays.SIX_MONTHS,
    });
    const car_status_update_SM = new stepFunctions.StateMachine(this, 'CarStatusUpdater', {
      definitionBody: stepFunctions.DefinitionBody.fromChainable(definition),
      timeout: Duration.minutes(9),
      tracingEnabled: true,
      logs: {
        destination: car_status_update_SM_log_group,
        level: stepFunctions.LogLevel.ALL,
      },
    });

    new awsEvents.Rule(this, 'CarStatusUpdateRule', {
      eventPattern: {
        source: ['aws.ssm'],
        detailType: ['EC2 State Manager Instance Association State Change'],
        detail: {
          'association-name': [stack.stackName + '-DeviceSWInventory'],
          status: ['Success'],
        },
      },
      targets: [
        new awsEventsTargets.SfnStateMachine(car_status_update_SM, {
          input: awsEvents.RuleTargetInput.fromObject({ NextToken: '' }),
          retryAttempts: 1,
        }),
      ],
    });

    // Define role used by lib/lambdas/device_activation_function/index.py
    const ssmRunCommandRole = new iam.Role(this, 'RoleAmazonEC2RunCommandRoleForManagedInstances', {
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
    });

    // Create an Association
    const ssmSWInventory = new ssm.CfnAssociation(this, 'SoftwareInventory', {
      associationName: stack.stackName + '-DeviceSWInventory',
      name: 'AWS-GatherSoftwareInventory',
      scheduleExpression: 'rate(12 hours)',
      targets: [
        {
          key: 'tag:Type',
          values: ['deepracer', 'timer'],
        },
      ],
      parameters: {
        applications: ['Enabled'],
        awsComponents: ['Enabled'],
        billingInfo: ['Disabled'],
        customInventory: ['Disabled'],
        files: [''],
        instanceDetailedInformation: ['Enabled'],
        networkConfig: ['Enabled'],
        services: ['Disabled'],
        windowsRegistry: [''],
        windowsRoles: ['Disabled'],
        windowsUpdates: ['Disabled'],
      },
      complianceSeverity: 'LOW',
    });

    // device_activation method
    const device_activation_handler = new StandardLambdaPythonFunction(this, 'device_activation_handler', {
      entry: 'lib/lambdas/device_activation_function/',
      description: 'Device Activation',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [props.lambdaConfig.layersConfig.powerToolsLayer],

      environment: {
        POWERTOOLS_SERVICE_NAME: 'device_activation',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        HYBRID_ACTIVATION_IAM_ROLE_NAME: ssmRunCommandRole.roleName,
      },
    });

    device_activation_handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:PassRole', 'ssm:AddTagsToResource', 'ssm:CreateActivation'],
        resources: ['*'],
      })
    );

    // device_activation_clean method - clean up unactivated and expired hybrid activations
    const device_activation_clean_handler = new StandardLambdaPythonFunction(this, 'device_activation_clean_handler', {
      entry: 'lib/lambdas/device_activation_clean/',
      description: 'Device Activation clean up unused activations',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(2),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],

      environment: {
        POWERTOOLS_SERVICE_NAME: 'device_activation_clean',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
      },
    });

    new awsEvents.Rule(this, 'device_activation_clean_handler_cron', {
      schedule: awsEvents.Schedule.cron({ minute: '0', hour: '1' }),
      targets: [new awsEventsTargets.LambdaFunction(device_activation_clean_handler)],
    });

    device_activation_clean_handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:DeleteActivation', 'ssm:DescribeActivations'],
        resources: ['*'],
      })
    );

    // Define the data source for the API
    const device_activation_data_source = props.appsyncApi.api.addLambdaDataSource(
      'DeviceActivationDataSource',
      device_activation_handler
    );

    NagSuppressions.addResourceSuppressions(
      device_activation_data_source,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress wildcard that covers Lambda aliases in resource path',
          appliesTo: [
            {
              regex: '/^Resource::(.+):\\*$/g',
            },
          ],
        },
      ],
      true
    );

    // Define API Schema
    const deviceActivationObjectType = new ObjectType('deviceActivation', {
      definition: {
        region: GraphqlType.string(),
        activationCode: GraphqlType.id(),
        activationId: GraphqlType.string(),
      },
    });

    props.appsyncApi.schema.addType(deviceActivationObjectType);

    // Event methods
    props.appsyncApi.schema.addMutation(
      'deviceActivation',
      new ResolvableField({
        args: {
          hostname: GraphqlType.string({ isRequired: true }),
          deviceType: GraphqlType.string({ isRequired: true }),
          fleetName: GraphqlType.string({ isRequired: true }),
          fleetId: GraphqlType.id({ isRequired: true }),
          deviceUiPassword: GraphqlType.string({ isRequired: true }),
        },
        returnType: deviceActivationObjectType.attribute(),
        dataSource: device_activation_data_source,
      })
    );

    // cars_function_handler
    const cars_function_handler = new StandardLambdaPythonFunction(this, 'cars_function_handler', {
      entry: 'lib/lambdas/cars_function/',
      description: 'Cars Function',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(5),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      bundling: { image: props.lambdaConfig.bundlingImage },
      layers: [props.lambdaConfig.layersConfig.powerToolsLayer],
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_function',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        DDB_TABLE: carStatusTable.tableName,
        DDB_PING_STATE_INDEX: carsTable_ping_state_index_name,
        STEP_FUNCTION_ARN: car_status_update_SM.stateMachineArn,
      },
    });

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
          'ssm:DeregisterManagedInstance',
        ],
        resources: ['*'],
      })
    );

    cars_function_handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['states:StartExecution', 'states:ListExecutions', 'states:DescribeExecution'],
        resources: [car_status_update_SM.stateMachineArn],
      })
    );

    carStatusTable.grantReadWriteData(cars_function_handler);

    // Define the data source for the API
    const cars_data_source = props.appsyncApi.api.addLambdaDataSource('CarsDataSource', cars_function_handler);

    NagSuppressions.addResourceSuppressions(
      cars_data_source,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress wildcard that covers Lambda aliases in resource path',
          appliesTo: [
            {
              regex: '/^Resource::(.+):\\*$/g',
            },
          ],
        },
      ],
      true
    );

    // Define API Schema (returned data)
    const car_object_type_definition = {
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
      Type: GraphqlType.string(),
      DeviceUiPassword: GraphqlType.string(),
      DeepRacerCoreVersion: GraphqlType.string(),
      LoggingCapable: GraphqlType.boolean(),
    };

    const car_online_object_type = new ObjectType('carOnline', {
      definition: car_object_type_definition,
      directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(car_online_object_type);

    const car_online_input_type = new InputType('carOnlineInput', {
      definition: car_object_type_definition,
      directives: [Directive.iam()],
    });
    props.appsyncApi.schema.addType(car_online_input_type);

    // Event methods (input data)
    props.appsyncApi.schema.addQuery(
      'listCars',
      new ResolvableField({
        args: {
          online: GraphqlType.boolean({ isRequired: true }),
        },
        returnType: car_online_object_type.attribute({ isList: true }),
        dataSource: cars_data_source,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'carsUpdateStatus',
      new ResolvableField({
        args: {
          cars: car_online_input_type.attribute({ isList: true, isRequired: true }),
        },
        returnType: car_online_object_type.attribute({ isList: true }),
        dataSource: cars_data_source,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'carsUpdateFleet',
      new ResolvableField({
        args: {
          resourceIds: GraphqlType.string({
            isList: true,
            isRequired: true,
          }),
          fleetId: GraphqlType.string({ isRequired: true }),
          fleetName: GraphqlType.string({ isRequired: true }),
        },
        returnType: car_online_object_type.attribute({ isList: true }),
        dataSource: cars_data_source,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'carsDelete',
      new ResolvableField({
        args: {
          resourceIds: GraphqlType.string({ isList: true, isRequired: true }),
        },
        returnType: GraphqlType.awsJson(),
        dataSource: cars_data_source,
        directives: [Directive.cognito('admin')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'carDeleteAllModels',
      new ResolvableField({
        args: {
          resourceIds: GraphqlType.string({ isList: true, isRequired: true }),
          withSystemLogs: GraphqlType.boolean({ isRequired: false }),
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

    props.appsyncApi.schema.addSubscription(
      'onUpdatedCarsInfo',
      new ResolvableField({
        returnType: car_online_object_type.attribute({ isList: true }),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [
          Directive.subscribe('carsUpdateStatus', 'carsUpdateFleet'),
          Directive.cognito('admin', 'operator'),
        ],
      })
    );

    // All Methods...

    // data fetching lambda for label printing
    const labelPrinterDataFetchHandler = new StandardLambdaPythonFunction(this, 'labelPrinterDataFetchHandler', {
      entry: 'lib/lambdas/get_data_for_label_printing',
      description: 'Serves data needed for label printing',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
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
    });

    this.carStatusDataHandlerLambda = labelPrinterDataFetchHandler;
    carStatusTable.grantReadData(labelPrinterDataFetchHandler);
  }
}
