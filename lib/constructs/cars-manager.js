'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CarManager = void 0;
const lambdaPython = require('@aws-cdk/aws-lambda-python-alpha');
const aws_cdk_lib_1 = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const awsEvents = require('aws-cdk-lib/aws-events');
const awsEventsTargets = require('aws-cdk-lib/aws-events-targets');
const iam = require('aws-cdk-lib/aws-iam');
const lambda = require('aws-cdk-lib/aws-lambda');
const stepFunctions = require('aws-cdk-lib/aws-stepfunctions');
const stepFunctionsTasks = require('aws-cdk-lib/aws-stepfunctions-tasks');
const awscdk_appsync_utils_1 = require('awscdk-appsync-utils');
const constructs_1 = require('constructs');
class CarManager extends constructs_1.Construct {
  // public readonly origin: cloudfront.IOrigin;
  // public readonly sourceBucket: s3.IBucket;
  constructor(scope, id, props) {
    super(scope, id);
    const carsTable = new dynamodb.Table(this, 'CarsStatusTable', {
      partitionKey: {
        name: 'InstanceId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
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
    const carStatusUpdateHandler = new lambdaPython.PythonFunction(this, 'carStatusUpdateHandler', {
      entry: 'lib/lambdas/car_status_update_function',
      description: 'Car Status Updates',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: aws_cdk_lib_1.Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      //            layers: [base_stack._powertools_layer],   // TODO uncomment when fixed in base stack
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_status_update',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        DDB_TABLE: carsTable.tableName,
      },
    });
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
          .when(stepFunctions.Condition.isPresent('$.NextToken'), describeInstanceInformationTask)
          .otherwise(succeed_job)
      );
    const car_status_update_SM = new stepFunctions.StateMachine(this, 'CarStatusUpdater', {
      definition: definition,
      timeout: aws_cdk_lib_1.Duration.minutes(3),
    });
    new awsEvents.Rule(this, 'CarStatusUpdateRule', {
      schedule: awsEvents.Schedule.rate(aws_cdk_lib_1.Duration.minutes(5)),
      targets: [
        new awsEventsTargets.SfnStateMachine(car_status_update_SM, {
          input: awsEvents.RuleTargetInput.fromObject({ NextToken: '' }),
          retryAttempts: 1,
        }),
      ],
    });
    // car_activation method
    const car_activation_handler = new lambdaPython.PythonFunction(this, 'car_activation_handler', {
      entry: 'lib/lambdas/car_activation_function/',
      description: 'Car Activation',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: aws_cdk_lib_1.Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      //            layers: [base_stack._powertools_layer], // TODO uncomment when fixed in base stack
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_activation',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
      },
    });
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
    const carActivationObjectType = new awscdk_appsync_utils_1.ObjectType('carActivation', {
      definition: {
        region: awscdk_appsync_utils_1.GraphqlType.string(),
        activationCode: awscdk_appsync_utils_1.GraphqlType.id(),
        activationId: awscdk_appsync_utils_1.GraphqlType.string(),
      },
    });
    props.appsyncApi.schema.addType(carActivationObjectType);
    // Event methods
    props.appsyncApi.schema.addMutation(
      'carActivation',
      new awscdk_appsync_utils_1.ResolvableField({
        args: {
          hostname: awscdk_appsync_utils_1.GraphqlType.string({ isRequired: true }),
          fleetId: awscdk_appsync_utils_1.GraphqlType.id({ isRequired: true }),
          fleetName: awscdk_appsync_utils_1.GraphqlType.string({ isRequired: true }),
        },
        returnType: carActivationObjectType.attribute(),
        dataSource: car_activation_data_source,
      })
    );
    // cars_function_handler
    const cars_function_handler = new lambdaPython.PythonFunction(this, 'cars_function_handler', {
      entry: 'lib/lambdas/cars_function/',
      description: 'Cars Function',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: aws_cdk_lib_1.Duration.minutes(5),
      runtime: props.lambdaConfig.runtime,
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      bundling: { image: props.lambdaConfig.bundlingImage },
      //            layers: [base_stack._powertools_layer], // TODO uncomment when fixed in base stack
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_function',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        DDB_TABLE: carsTable.tableName,
        DDB_PING_STATE_INDEX: carsTable_ping_state_index_name,
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
    const car_online_object_type = new awscdk_appsync_utils_1.ObjectType('carOnline', {
      definition: {
        InstanceId: awscdk_appsync_utils_1.GraphqlType.string(),
        PingStatus: awscdk_appsync_utils_1.GraphqlType.string(),
        LastPingDateTime: awscdk_appsync_utils_1.GraphqlType.string(),
        AgentVersion: awscdk_appsync_utils_1.GraphqlType.string(),
        IsLatestVersion: awscdk_appsync_utils_1.GraphqlType.boolean(),
        PlatformType: awscdk_appsync_utils_1.GraphqlType.string(),
        PlatformName: awscdk_appsync_utils_1.GraphqlType.string(),
        PlatformVersion: awscdk_appsync_utils_1.GraphqlType.string(),
        ActivationId: awscdk_appsync_utils_1.GraphqlType.id(),
        IamRole: awscdk_appsync_utils_1.GraphqlType.string(),
        RegistrationDate: awscdk_appsync_utils_1.GraphqlType.string(),
        ResourceType: awscdk_appsync_utils_1.GraphqlType.string(),
        Name: awscdk_appsync_utils_1.GraphqlType.string(),
        IpAddress: awscdk_appsync_utils_1.GraphqlType.string(),
        ComputerName: awscdk_appsync_utils_1.GraphqlType.string(),
        // "SourceId": GraphqlType.string(),
        // "SourceType": GraphqlType.string(),
        fleetId: awscdk_appsync_utils_1.GraphqlType.id(),
        fleetName: awscdk_appsync_utils_1.GraphqlType.string(),
      },
    });
    props.appsyncApi.schema.addType(car_online_object_type);
    // Event methods (input data)
    props.appsyncApi.schema.addQuery(
      'carsOnline',
      new awscdk_appsync_utils_1.ResolvableField({
        args: {
          online: awscdk_appsync_utils_1.GraphqlType.boolean({ isRequired: true }),
        },
        returnType: car_online_object_type.attribute({ isList: true }),
        dataSource: cars_data_source,
      })
    );
    props.appsyncApi.schema.addMutation(
      'carUpdates',
      new awscdk_appsync_utils_1.ResolvableField({
        args: {
          resourceIds: awscdk_appsync_utils_1.GraphqlType.string({
            isList: true,
            isRequired: true,
          }),
          fleetId: awscdk_appsync_utils_1.GraphqlType.string({ isRequired: true }),
          fleetName: awscdk_appsync_utils_1.GraphqlType.string({ isRequired: true }),
        },
        returnType: awscdk_appsync_utils_1.GraphqlType.awsJson(),
        dataSource: cars_data_source,
      })
    );
    props.appsyncApi.schema.addMutation(
      'carDeleteAllModels',
      new awscdk_appsync_utils_1.ResolvableField({
        args: {
          resourceIds: awscdk_appsync_utils_1.GraphqlType.string({
            isList: true,
            isRequired: true,
          }),
        },
        returnType: awscdk_appsync_utils_1.GraphqlType.awsJson(),
        dataSource: cars_data_source,
      })
    );
    props.appsyncApi.schema.addMutation(
      'carSetTaillightColor',
      new awscdk_appsync_utils_1.ResolvableField({
        args: {
          resourceIds: awscdk_appsync_utils_1.GraphqlType.string({
            isList: true,
            isRequired: true,
          }),
          selectedColor: awscdk_appsync_utils_1.GraphqlType.string({
            isList: false,
            isRequired: true,
          }),
        },
        returnType: awscdk_appsync_utils_1.GraphqlType.awsJson(),
        dataSource: cars_data_source,
      })
    );
    props.appsyncApi.schema.addQuery(
      'availableTaillightColors',
      new awscdk_appsync_utils_1.ResolvableField({
        returnType: awscdk_appsync_utils_1.GraphqlType.awsJson(),
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
exports.CarManager = CarManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2Fycy1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2Fycy1tYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGlFQUFpRTtBQUNqRSw2Q0FBbUU7QUFFbkUscURBQXFEO0FBQ3JELG9EQUFvRDtBQUNwRCxtRUFBbUU7QUFDbkUsMkNBQTJDO0FBRTNDLGlEQUFpRDtBQUNqRCwrREFBK0Q7QUFDL0QsMEVBQTBFO0FBQzFFLCtEQUFpRztBQUdqRywyQ0FBdUM7QUFtQnZDLE1BQWEsVUFBVyxTQUFRLHNCQUFTO0lBQ3JDLDhDQUE4QztJQUM5Qyw0Q0FBNEM7SUFFNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM1RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sU0FBUyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FDaEMsSUFBSSxFQUNKLGlCQUFpQixFQUFFO1lBQ25CLFlBQVksRUFBRTtnQkFDVixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUN0QztZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUNoRCxhQUFhLEVBQUUsMkJBQWEsQ0FBQyxPQUFPO1NBQ3ZDLENBQUMsQ0FBQTtRQUVGLE1BQU0sK0JBQStCLEdBQUcsWUFBWSxDQUFBO1FBQ3BELFNBQVMsQ0FBQyx1QkFBdUIsQ0FBQztZQUM5QixTQUFTLEVBQUUsK0JBQStCO1lBQzFDLFlBQVksRUFBRTtnQkFDVixJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDMUQ7WUFDRCxPQUFPLEVBQUU7Z0JBQ0wsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEs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QkFDM0QsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLG1DQUFtQzt3QkFDOUQsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLDJDQUEyQzt3QkFDdEUsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLDZDQUE2Qzt3QkFDeEUsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLDhDQUE4QztxQkFDNUU7aUJBQ0osQ0FBQzthQUNMO1NBQ0osQ0FBQyxDQUFBO1FBQ0YsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQTtJQUN2RCxDQUFDO0NBQ0o7QUEvVUQsZ0NBK1VDIiwic291cmNlc0NvbnRlbnQiOlsiXG5pbXBvcnQgKiBhcyBsYW1iZGFQeXRob24gZnJvbSAnQGF3cy1jZGsvYXdzLWxhbWJkYS1weXRob24tYWxwaGEnO1xuaW1wb3J0IHsgRG9ja2VySW1hZ2UsIER1cmF0aW9uLCBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgYXBwc3luYyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBwc3luYyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgYXdzRXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgYXdzRXZlbnRzVGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgSVJvbGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIHN0ZXBGdW5jdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgc3RlcEZ1bmN0aW9uc1Rhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCB7IENvZGVGaXJzdFNjaGVtYSwgR3JhcGhxbFR5cGUsIE9iamVjdFR5cGUsIFJlc29sdmFibGVGaWVsZCB9IGZyb20gJ2F3c2Nkay1hcHBzeW5jLXV0aWxzJztcblxuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBDYXJNYW5hZ2VyUHJvcHMge1xuICAgIGFkbWluR3JvdXBSb2xlOiBJUm9sZSxcbiAgICBhcHBzeW5jQXBpOiB7XG4gICAgICAgIHNjaGVtYTogQ29kZUZpcnN0U2NoZW1hLFxuICAgICAgICBhcGk6IGFwcHN5bmMuSUdyYXBocWxBcGlcbiAgICB9LFxuICAgIGxhbWJkYUNvbmZpZzoge1xuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZSxcbiAgICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLFxuICAgICAgICBidW5kbGluZ0ltYWdlOiBEb2NrZXJJbWFnZVxuICAgICAgICBsYXllcnNDb25maWc6IHtcbiAgICAgICAgICAgIHBvd2VyVG9vbHNMb2dMZXZlbDogc3RyaW5nXG4gICAgICAgIH1cbiAgICB9XG5cbn1cblxuZXhwb3J0IGNsYXNzIENhck1hbmFnZXIgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAgIC8vIHB1YmxpYyByZWFkb25seSBvcmlnaW46IGNsb3VkZnJvbnQuSU9yaWdpbjtcbiAgICAvLyBwdWJsaWMgcmVhZG9ubHkgc291cmNlQnVja2V0OiBzMy5JQnVja2V0O1xuXG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IENhck1hbmFnZXJQcm9wcykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIGNvbnN0IGNhcnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZShcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBcIkNhcnNTdGF0dXNUYWJsZVwiLCB7XG4gICAgICAgICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkluc3RhbmNlSWRcIixcbiAgICAgICAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICAgICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICAgICAgfSlcblxuICAgICAgICBjb25zdCBjYXJzVGFibGVfcGluZ19zdGF0ZV9pbmRleF9uYW1lID0gXCJwaW5nU3RhdHVzXCJcbiAgICAgICAgY2Fyc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgICAgICAgIGluZGV4TmFtZTogY2Fyc1RhYmxlX3Bpbmdfc3RhdGVfaW5kZXhfbmFtZSxcbiAgICAgICAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICAgICAgICAgIG5hbWU6IFwiUGluZ1N0YXR1c1wiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkluc3RhbmNlSWRcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG4gICAgICAgIGNvbnN0IGNhclN0YXR1c1VwZGF0ZUhhbmRsZXIgPSBuZXcgbGFtYmRhUHl0aG9uLlB5dGhvbkZ1bmN0aW9uKHRoaXMsIFwiY2FyU3RhdHVzVXBkYXRlSGFuZGxlclwiLCB7XG4gICAgICAgICAgICBlbnRyeTogXCJsaWIvbGFtYmRhcy9jYXJfc3RhdHVzX3VwZGF0ZV9mdW5jdGlvblwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQ2FyIFN0YXR1cyBVcGRhdGVzXCIsXG4gICAgICAgICAgICBpbmRleDogXCJpbmRleC5weVwiLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJsYW1iZGFfaGFuZGxlclwiLFxuICAgICAgICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIHJ1bnRpbWU6IHByb3BzLmxhbWJkYUNvbmZpZy5ydW50aW1lLFxuICAgICAgICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxuICAgICAgICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgICAgICAgYXJjaGl0ZWN0dXJlOiBwcm9wcy5sYW1iZGFDb25maWcuYXJjaGl0ZWN0dXJlLFxuICAgICAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICAgICAgICBpbWFnZTogcHJvcHMubGFtYmRhQ29uZmlnLmJ1bmRsaW5nSW1hZ2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyAgICAgICAgICAgIGxheWVyczogW2Jhc2Vfc3RhY2suX3Bvd2VydG9vbHNfbGF5ZXJdLCAgIC8vIFRPRE8gdW5jb21tZW50IHdoZW4gZml4ZWQgaW4gYmFzZSBzdGFja1xuICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICBcIlBPV0VSVE9PTFNfU0VSVklDRV9OQU1FXCI6IFwiY2FyX3N0YXR1c191cGRhdGVcIixcbiAgICAgICAgICAgICAgICBcIkxPR19MRVZFTFwiOiBwcm9wcy5sYW1iZGFDb25maWcubGF5ZXJzQ29uZmlnLnBvd2VyVG9vbHNMb2dMZXZlbCxcbiAgICAgICAgICAgICAgICBcIkREQl9UQUJMRVwiOiBjYXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgICApXG5cbiAgICAgICAgY2Fyc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjYXJTdGF0dXNVcGRhdGVIYW5kbGVyKVxuXG4gICAgICAgIGNhclN0YXR1c1VwZGF0ZUhhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgIFwic3NtOkxpc3RUYWdzRm9yUmVzb3VyY2VcIixcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgIClcblxuICAgICAgICBjb25zdCBzdGF0dXNfdXBkYXRlX2pvYiA9IG5ldyBzdGVwRnVuY3Rpb25zVGFza3MuTGFtYmRhSW52b2tlKHRoaXMsIFwiVXBkYXRlIFN0YXR1c1wiLCB7XG4gICAgICAgICAgICBsYW1iZGFGdW5jdGlvbjogY2FyU3RhdHVzVXBkYXRlSGFuZGxlcixcbiAgICAgICAgICAgIG91dHB1dFBhdGg6IFwiJC5QYXlsb2FkXCIsXG4gICAgICAgIH0pXG5cbiAgICAgICAgY29uc3QgZGVzY3JpYmVJbnN0YW5jZUluZm9ybWF0aW9uVGFzayA9IG5ldyBzdGVwRnVuY3Rpb25zVGFza3MuQ2FsbEF3c1NlcnZpY2UodGhpcyxcbiAgICAgICAgICAgIFwiRGVzY3JpYmVJbnN0YW5jZUluZm9ybWF0aW9uXCIsIHtcbiAgICAgICAgICAgIHNlcnZpY2U6IFwic3NtXCIsXG4gICAgICAgICAgICBhY3Rpb246IFwiZGVzY3JpYmVJbnN0YW5jZUluZm9ybWF0aW9uXCIsXG4gICAgICAgICAgICBpYW1SZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgXCJNYXhSZXN1bHRzXCI6IDUwLFxuICAgICAgICAgICAgICAgIFwiTmV4dFRva2VuLiRcIjogXCIkLk5leHRUb2tlblwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlc3VsdFBhdGg6IFwiJC5JbnN0YW5jZXNcIixcbiAgICAgICAgfVxuICAgICAgICApXG5cbiAgICAgICAgY29uc3Qgc3VjY2VlZF9qb2IgPSBuZXcgc3RlcEZ1bmN0aW9ucy5TdWNjZWVkKHRoaXMsIFwiU3VjY2VlZGVkXCIsIHtcbiAgICAgICAgICAgIGNvbW1lbnQ6IFwiQVdTIEJhdGNoIEpvYiBzdWNjZWVkZWRcIlxuICAgICAgICB9KVxuXG4gICAgICAgIGNvbnN0IGRlZmluaXRpb24gPSBkZXNjcmliZUluc3RhbmNlSW5mb3JtYXRpb25UYXNrLm5leHQoc3RhdHVzX3VwZGF0ZV9qb2IpLm5leHQoXG4gICAgICAgICAgICBuZXcgc3RlcEZ1bmN0aW9ucy5DaG9pY2UodGhpcywgXCJKb2IgZG9uZT9cIilcbiAgICAgICAgICAgICAgICAud2hlbihcbiAgICAgICAgICAgICAgICAgICAgc3RlcEZ1bmN0aW9ucy5Db25kaXRpb24uaXNQcmVzZW50KFwiJC5OZXh0VG9rZW5cIiksXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaWJlSW5zdGFuY2VJbmZvcm1hdGlvblRhc2ssXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIC5vdGhlcndpc2Uoc3VjY2VlZF9qb2IpXG4gICAgICAgIClcblxuICAgICAgICBjb25zdCBjYXJfc3RhdHVzX3VwZGF0ZV9TTSA9IG5ldyBzdGVwRnVuY3Rpb25zLlN0YXRlTWFjaGluZShcbiAgICAgICAgICAgIHRoaXMsIFwiQ2FyU3RhdHVzVXBkYXRlclwiLCB7IGRlZmluaXRpb246IGRlZmluaXRpb24sIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMykgfVxuICAgICAgICApXG5cbiAgICAgICAgbmV3IGF3c0V2ZW50cy5SdWxlKFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIFwiQ2FyU3RhdHVzVXBkYXRlUnVsZVwiLCB7XG4gICAgICAgICAgICBzY2hlZHVsZTogYXdzRXZlbnRzLlNjaGVkdWxlLnJhdGUoRHVyYXRpb24ubWludXRlcyg1KSksXG4gICAgICAgICAgICB0YXJnZXRzOiBbXG4gICAgICAgICAgICAgICAgbmV3IGF3c0V2ZW50c1RhcmdldHMuU2ZuU3RhdGVNYWNoaW5lKFxuICAgICAgICAgICAgICAgICAgICBjYXJfc3RhdHVzX3VwZGF0ZV9TTSwge1xuICAgICAgICAgICAgICAgICAgICBpbnB1dDogYXdzRXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHsgXCJOZXh0VG9rZW5cIjogXCJcIiB9KSxcbiAgICAgICAgICAgICAgICAgICAgcmV0cnlBdHRlbXB0czogMSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgXSxcbiAgICAgICAgfVxuICAgICAgICApXG5cbiAgICAgICAgLy8gY2FyX2FjdGl2YXRpb24gbWV0aG9kXG4gICAgICAgIGNvbnN0IGNhcl9hY3RpdmF0aW9uX2hhbmRsZXIgPSBuZXcgbGFtYmRhUHl0aG9uLlB5dGhvbkZ1bmN0aW9uKHRoaXMsIFwiY2FyX2FjdGl2YXRpb25faGFuZGxlclwiLCB7XG4gICAgICAgICAgICBlbnRyeTogXCJsaWIvbGFtYmRhcy9jYXJfYWN0aXZhdGlvbl9mdW5jdGlvbi9cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkNhciBBY3RpdmF0aW9uXCIsXG4gICAgICAgICAgICBpbmRleDogXCJpbmRleC5weVwiLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJsYW1iZGFfaGFuZGxlclwiLFxuICAgICAgICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIHJ1bnRpbWU6IHByb3BzLmxhbWJkYUNvbmZpZy5ydW50aW1lLFxuICAgICAgICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxuICAgICAgICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgICAgICAgYXJjaGl0ZWN0dXJlOiBwcm9wcy5sYW1iZGFDb25maWcuYXJjaGl0ZWN0dXJlLFxuICAgICAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICAgICAgICBpbWFnZTogcHJvcHMubGFtYmRhQ29uZmlnLmJ1bmRsaW5nSW1hZ2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyAgICAgICAgICAgIGxheWVyczogW2Jhc2Vfc3RhY2suX3Bvd2VydG9vbHNfbGF5ZXJdLCAvLyBUT0RPIHVuY29tbWVudCB3aGVuIGZpeGVkIGluIGJhc2Ugc3RhY2tcbiAgICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICAgICAgXCJQT1dFUlRPT0xTX1NFUlZJQ0VfTkFNRVwiOiBcImNhcl9hY3RpdmF0aW9uXCIsXG4gICAgICAgICAgICAgICAgXCJMT0dfTEVWRUxcIjogcHJvcHMubGFtYmRhQ29uZmlnLmxheWVyc0NvbmZpZy5wb3dlclRvb2xzTG9nTGV2ZWwsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICAgIClcblxuICAgICAgICBjYXJfYWN0aXZhdGlvbl9oYW5kbGVyLmFkZFRvUm9sZVBvbGljeShcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICBcImlhbTpQYXNzUm9sZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInNzbTpBZGRUYWdzVG9SZXNvdXJjZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInNzbTpDcmVhdGVBY3RpdmF0aW9uXCIsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICAgICAgICB9KVxuICAgICAgICApXG5cbiAgICAgICAgLy8gRGVmaW5lIHRoZSBkYXRhIHNvdXJjZSBmb3IgdGhlIEFQSVxuICAgICAgICBjb25zdCBjYXJfYWN0aXZhdGlvbl9kYXRhX3NvdXJjZSA9IHByb3BzLmFwcHN5bmNBcGkuYXBpLmFkZExhbWJkYURhdGFTb3VyY2UoXG4gICAgICAgICAgICBcImNhcl9hY3RpdmF0aW9uX2RhdGFfc291cmNlXCIsIGNhcl9hY3RpdmF0aW9uX2hhbmRsZXJcbiAgICAgICAgKVxuXG4gICAgICAgIC8vIERlZmluZSBBUEkgU2NoZW1hXG4gICAgICAgIGNvbnN0IGNhckFjdGl2YXRpb25PYmplY3RUeXBlID0gbmV3IE9iamVjdFR5cGUoXG4gICAgICAgICAgICBcImNhckFjdGl2YXRpb25cIiwge1xuICAgICAgICAgICAgZGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgICAgIHJlZ2lvbjogR3JhcGhxbFR5cGUuc3RyaW5nKCksXG4gICAgICAgICAgICAgICAgYWN0aXZhdGlvbkNvZGU6IEdyYXBocWxUeXBlLmlkKCksXG4gICAgICAgICAgICAgICAgYWN0aXZhdGlvbklkOiBHcmFwaHFsVHlwZS5zdHJpbmcoKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pXG5cbiAgICAgICAgcHJvcHMuYXBwc3luY0FwaS5zY2hlbWEuYWRkVHlwZShjYXJBY3RpdmF0aW9uT2JqZWN0VHlwZSlcblxuICAgICAgICAvLyBFdmVudCBtZXRob2RzXG4gICAgICAgIHByb3BzLmFwcHN5bmNBcGkuc2NoZW1hLmFkZE11dGF0aW9uKFxuICAgICAgICAgICAgXCJjYXJBY3RpdmF0aW9uXCIsXG4gICAgICAgICAgICBuZXcgUmVzb2x2YWJsZUZpZWxkKHtcbiAgICAgICAgICAgICAgICBhcmdzOiB7XG4gICAgICAgICAgICAgICAgICAgIGhvc3RuYW1lOiBHcmFwaHFsVHlwZS5zdHJpbmcoeyBpc1JlcXVpcmVkOiB0cnVlIH0pLFxuICAgICAgICAgICAgICAgICAgICBmbGVldElkOiBHcmFwaHFsVHlwZS5pZCh7IGlzUmVxdWlyZWQ6IHRydWUgfSksXG4gICAgICAgICAgICAgICAgICAgIGZsZWV0TmFtZTogR3JhcGhxbFR5cGUuc3RyaW5nKHsgaXNSZXF1aXJlZDogdHJ1ZSB9KSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJldHVyblR5cGU6IGNhckFjdGl2YXRpb25PYmplY3RUeXBlLmF0dHJpYnV0ZSgpLFxuICAgICAgICAgICAgICAgIGRhdGFTb3VyY2U6IGNhcl9hY3RpdmF0aW9uX2RhdGFfc291cmNlLFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKSxcbiAgICAgICAgKVxuXG4gICAgICAgIC8vIGNhcnNfZnVuY3Rpb25faGFuZGxlclxuICAgICAgICBjb25zdCBjYXJzX2Z1bmN0aW9uX2hhbmRsZXIgPSBuZXcgbGFtYmRhUHl0aG9uLlB5dGhvbkZ1bmN0aW9uKFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIFwiY2Fyc19mdW5jdGlvbl9oYW5kbGVyXCIsIHtcbiAgICAgICAgICAgIGVudHJ5OiBcImxpYi9sYW1iZGFzL2NhcnNfZnVuY3Rpb24vXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJDYXJzIEZ1bmN0aW9uXCIsXG4gICAgICAgICAgICBpbmRleDogXCJpbmRleC5weVwiLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJsYW1iZGFfaGFuZGxlclwiLFxuICAgICAgICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHJ1bnRpbWU6IHByb3BzLmxhbWJkYUNvbmZpZy5ydW50aW1lLFxuICAgICAgICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxuICAgICAgICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgICAgICAgYXJjaGl0ZWN0dXJlOiBwcm9wcy5sYW1iZGFDb25maWcuYXJjaGl0ZWN0dXJlLFxuICAgICAgICAgICAgYnVuZGxpbmc6IHsgaW1hZ2U6IHByb3BzLmxhbWJkYUNvbmZpZy5idW5kbGluZ0ltYWdlIH0sXG4gICAgICAgICAgICAvLyAgICAgICAgICAgIGxheWVyczogW2Jhc2Vfc3RhY2suX3Bvd2VydG9vbHNfbGF5ZXJdLCAvLyBUT0RPIHVuY29tbWVudCB3aGVuIGZpeGVkIGluIGJhc2Ugc3RhY2tcbiAgICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICAgICAgXCJQT1dFUlRPT0xTX1NFUlZJQ0VfTkFNRVwiOiBcImNhcl9mdW5jdGlvblwiLFxuICAgICAgICAgICAgICAgIFwiTE9HX0xFVkVMXCI6IHByb3BzLmxhbWJkYUNvbmZpZy5sYXllcnNDb25maWcucG93ZXJUb29sc0xvZ0xldmVsLFxuICAgICAgICAgICAgICAgIFwiRERCX1RBQkxFXCI6IGNhcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgXCJEREJfUElOR19TVEFURV9JTkRFWFwiOiBjYXJzVGFibGVfcGluZ19zdGF0ZV9pbmRleF9uYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSlcblxuICAgICAgICBjYXJzX2Z1bmN0aW9uX2hhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgIFwic3NtOkRlc2NyaWJlSW5zdGFuY2VJbmZvcm1hdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICBcInNzbTpMaXN0VGFnc0ZvclJlc291cmNlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwic3NtOkFkZFRhZ3NUb1Jlc291cmNlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwic3NtOlJlbW92ZVRhZ3NGcm9tUmVzb3VyY2VcIixcbiAgICAgICAgICAgICAgICAgICAgXCJzc206U2VuZENvbW1hbmRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJzc206R2V0Q29tbWFuZEludm9jYXRpb25cIixcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgIClcblxuICAgICAgICBjYXJzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNhcnNfZnVuY3Rpb25faGFuZGxlcilcblxuICAgICAgICAvLyBEZWZpbmUgdGhlIGRhdGEgc291cmNlIGZvciB0aGUgQVBJXG4gICAgICAgIGNvbnN0IGNhcnNfZGF0YV9zb3VyY2UgPSBwcm9wcy5hcHBzeW5jQXBpLmFwaS5hZGRMYW1iZGFEYXRhU291cmNlKFxuICAgICAgICAgICAgXCJjYXJzX2RhdGFfc291cmNlXCIsIGNhcnNfZnVuY3Rpb25faGFuZGxlclxuICAgICAgICApXG5cbiAgICAgICAgLy8gRGVmaW5lIEFQSSBTY2hlbWEgKHJldHVybmVkIGRhdGEpXG4gICAgICAgIGNvbnN0IGNhcl9vbmxpbmVfb2JqZWN0X3R5cGUgPSBuZXcgT2JqZWN0VHlwZShcImNhck9ubGluZVwiLCB7XG4gICAgICAgICAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgICAgICAgICAgXCJJbnN0YW5jZUlkXCI6IEdyYXBocWxUeXBlLnN0cmluZygpLFxuICAgICAgICAgICAgICAgIFwiUGluZ1N0YXR1c1wiOiBHcmFwaHFsVHlwZS5zdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBcIkxhc3RQaW5nRGF0ZVRpbWVcIjogR3JhcGhxbFR5cGUuc3RyaW5nKCksXG4gICAgICAgICAgICAgICAgXCJBZ2VudFZlcnNpb25cIjogR3JhcGhxbFR5cGUuc3RyaW5nKCksXG4gICAgICAgICAgICAgICAgXCJJc0xhdGVzdFZlcnNpb25cIjogR3JhcGhxbFR5cGUuYm9vbGVhbigpLFxuICAgICAgICAgICAgICAgIFwiUGxhdGZvcm1UeXBlXCI6IEdyYXBocWxUeXBlLnN0cmluZygpLFxuICAgICAgICAgICAgICAgIFwiUGxhdGZvcm1OYW1lXCI6IEdyYXBocWxUeXBlLnN0cmluZygpLFxuICAgICAgICAgICAgICAgIFwiUGxhdGZvcm1WZXJzaW9uXCI6IEdyYXBocWxUeXBlLnN0cmluZygpLFxuICAgICAgICAgICAgICAgIFwiQWN0aXZhdGlvbklkXCI6IEdyYXBocWxUeXBlLmlkKCksXG4gICAgICAgICAgICAgICAgXCJJYW1Sb2xlXCI6IEdyYXBocWxUeXBlLnN0cmluZygpLFxuICAgICAgICAgICAgICAgIFwiUmVnaXN0cmF0aW9uRGF0ZVwiOiBHcmFwaHFsVHlwZS5zdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBcIlJlc291cmNlVHlwZVwiOiBHcmFwaHFsVHlwZS5zdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBcIk5hbWVcIjogR3JhcGhxbFR5cGUuc3RyaW5nKCksXG4gICAgICAgICAgICAgICAgXCJJcEFkZHJlc3NcIjogR3JhcGhxbFR5cGUuc3RyaW5nKCksXG4gICAgICAgICAgICAgICAgXCJDb21wdXRlck5hbWVcIjogR3JhcGhxbFR5cGUuc3RyaW5nKCksXG4gICAgICAgICAgICAgICAgLy8gXCJTb3VyY2VJZFwiOiBHcmFwaHFsVHlwZS5zdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAvLyBcIlNvdXJjZVR5cGVcIjogR3JhcGhxbFR5cGUuc3RyaW5nKCksXG4gICAgICAgICAgICAgICAgXCJmbGVldElkXCI6IEdyYXBocWxUeXBlLmlkKCksXG4gICAgICAgICAgICAgICAgXCJmbGVldE5hbWVcIjogR3JhcGhxbFR5cGUuc3RyaW5nKCksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KVxuXG4gICAgICAgIHByb3BzLmFwcHN5bmNBcGkuc2NoZW1hLmFkZFR5cGUoY2FyX29ubGluZV9vYmplY3RfdHlwZSlcblxuICAgICAgICAvLyBFdmVudCBtZXRob2RzIChpbnB1dCBkYXRhKVxuICAgICAgICBwcm9wcy5hcHBzeW5jQXBpLnNjaGVtYS5hZGRRdWVyeShcImNhcnNPbmxpbmVcIixcbiAgICAgICAgICAgIG5ldyBSZXNvbHZhYmxlRmllbGQoe1xuICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJvbmxpbmVcIjogR3JhcGhxbFR5cGUuYm9vbGVhbih7IGlzUmVxdWlyZWQ6IHRydWUgfSksXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXR1cm5UeXBlOiBjYXJfb25saW5lX29iamVjdF90eXBlLmF0dHJpYnV0ZSh7IGlzTGlzdDogdHJ1ZSB9KSxcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlOiBjYXJzX2RhdGFfc291cmNlLFxuICAgICAgICAgICAgfSksXG4gICAgICAgIClcblxuICAgICAgICBwcm9wcy5hcHBzeW5jQXBpLnNjaGVtYS5hZGRNdXRhdGlvbihcImNhclVwZGF0ZXNcIixcbiAgICAgICAgICAgIG5ldyBSZXNvbHZhYmxlRmllbGQoe1xuICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VJZHM6IEdyYXBocWxUeXBlLnN0cmluZyh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc0xpc3Q6IHRydWUsIGlzUmVxdWlyZWQ6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICBmbGVldElkOiBHcmFwaHFsVHlwZS5zdHJpbmcoeyBpc1JlcXVpcmVkOiB0cnVlIH0pLFxuICAgICAgICAgICAgICAgICAgICBmbGVldE5hbWU6IEdyYXBocWxUeXBlLnN0cmluZyh7IGlzUmVxdWlyZWQ6IHRydWUgfSksXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXR1cm5UeXBlOiBHcmFwaHFsVHlwZS5hd3NKc29uKCksXG4gICAgICAgICAgICAgICAgZGF0YVNvdXJjZTogY2Fyc19kYXRhX3NvdXJjZSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICApXG5cbiAgICAgICAgcHJvcHMuYXBwc3luY0FwaS5zY2hlbWEuYWRkTXV0YXRpb24oXG4gICAgICAgICAgICBcImNhckRlbGV0ZUFsbE1vZGVsc1wiLFxuICAgICAgICAgICAgbmV3IFJlc29sdmFibGVGaWVsZCh7XG4gICAgICAgICAgICAgICAgYXJnczoge1xuICAgICAgICAgICAgICAgICAgICBcInJlc291cmNlSWRzXCI6IEdyYXBocWxUeXBlLnN0cmluZyhcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgaXNMaXN0OiB0cnVlLCBpc1JlcXVpcmVkOiB0cnVlIH1cbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJldHVyblR5cGU6IEdyYXBocWxUeXBlLmF3c0pzb24oKSxcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlOiBjYXJzX2RhdGFfc291cmNlLFxuICAgICAgICAgICAgfSksXG4gICAgICAgIClcblxuICAgICAgICBwcm9wcy5hcHBzeW5jQXBpLnNjaGVtYS5hZGRNdXRhdGlvbihcbiAgICAgICAgICAgIFwiY2FyU2V0VGFpbGxpZ2h0Q29sb3JcIixcbiAgICAgICAgICAgIG5ldyBSZXNvbHZhYmxlRmllbGQoe1xuICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJyZXNvdXJjZUlkc1wiOiBHcmFwaHFsVHlwZS5zdHJpbmcoXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGlzTGlzdDogdHJ1ZSwgaXNSZXF1aXJlZDogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgIFwic2VsZWN0ZWRDb2xvclwiOiBHcmFwaHFsVHlwZS5zdHJpbmcoXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGlzTGlzdDogZmFsc2UsIGlzUmVxdWlyZWQ6IHRydWUgfVxuICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmV0dXJuVHlwZTogR3JhcGhxbFR5cGUuYXdzSnNvbigpLFxuICAgICAgICAgICAgICAgIGRhdGFTb3VyY2U6IGNhcnNfZGF0YV9zb3VyY2UsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgKVxuXG4gICAgICAgIHByb3BzLmFwcHN5bmNBcGkuc2NoZW1hLmFkZFF1ZXJ5KFxuICAgICAgICAgICAgXCJhdmFpbGFibGVUYWlsbGlnaHRDb2xvcnNcIixcbiAgICAgICAgICAgIG5ldyBSZXNvbHZhYmxlRmllbGQoe1xuICAgICAgICAgICAgICAgIHJldHVyblR5cGU6IEdyYXBocWxUeXBlLmF3c0pzb24oKSxcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlOiBjYXJzX2RhdGFfc291cmNlLFxuICAgICAgICAgICAgfSksXG4gICAgICAgIClcblxuICAgICAgICAvLyBBbGwgTWV0aG9kcy4uLlxuICAgICAgICAvLyBHcmFudCBhY2Nlc3Mgc28gQVBJIG1ldGhvZHMgY2FuIGJlIGludm9rZWRcbiAgICAgICAgY29uc3QgYWRtaW5fYXBpX3BvbGljeSA9IG5ldyBpYW0uUG9saWN5KHRoaXMsIFwiYWRtaW5BcGlQb2xpY3lcIiwge1xuICAgICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXCJhcHBzeW5jOkdyYXBoUUxcIl0sXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgYCR7cHJvcHMuYXBwc3luY0FwaS5hcGkuYXJufS90eXBlcy9NdXRhdGlvbi9maWVsZHMvY2FyQWN0aXZhdGlvbmAsXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtwcm9wcy5hcHBzeW5jQXBpLmFwaS5hcm59L3R5cGVzL1F1ZXJ5L2ZpZWxkcy9jYXJzT25saW5lYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke3Byb3BzLmFwcHN5bmNBcGkuYXBpLmFybn0vdHlwZXMvTXV0YXRpb24vZmllbGRzL2NhclVwZGF0ZXNgLFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7cHJvcHMuYXBwc3luY0FwaS5hcGkuYXJufS90eXBlcy9NdXRhdGlvbi9maWVsZHMvY2FyRGVsZXRlQWxsTW9kZWxzYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke3Byb3BzLmFwcHN5bmNBcGkuYXBpLmFybn0vdHlwZXMvTXV0YXRpb24vZmllbGRzL2NhclNldFRhaWxsaWdodENvbG9yYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke3Byb3BzLmFwcHN5bmNBcGkuYXBpLmFybn0vdHlwZXMvUXVlcnkvZmllbGRzL2F2YWlsYWJsZVRhaWxsaWdodENvbG9yc2AsXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pXG4gICAgICAgIGFkbWluX2FwaV9wb2xpY3kuYXR0YWNoVG9Sb2xlKHByb3BzLmFkbWluR3JvdXBSb2xlKVxuICAgIH1cbn1cbiJdfQ==
