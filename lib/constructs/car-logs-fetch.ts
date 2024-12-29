import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as stepFunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepFunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Directive, GraphqlType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';
import { Construct } from 'constructs';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

export class CarLogsFetchStepFunction extends Construct {
  readonly stepFunction: stepFunctions.StateMachine;

  constructor(scope: Construct, id: string, bagUploadBucket: s3.Bucket, props: any) {
    super(scope, id);

    const fetchJobsTable = new dynamodb.Table(this, 'CarLogsFetchJobTable', {
      partitionKey: {
        name: 'jobId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    const globalSecondaryIndexProps: dynamodb.GlobalSecondaryIndexProps = {
      indexName: 'eventId',
      partitionKey: {
        name: 'eventId',
        type: dynamodb.AttributeType.STRING,
      },
    };

    fetchJobsTable.addGlobalSecondaryIndex(globalSecondaryIndexProps);

    // Create
    const fetchFromCarSFNCreate = new StandardLambdaPythonFunction(this, 'fetchFromCarSFNCreate', {
      entry: 'lib/lambdas/car_logs_fetch_from_car_stepfunction_create',
      description: 'Starts the fetch from car process',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_logs_fetch_from_car_stepfunction_create',
        DDB_TABLE: fetchJobsTable.tableName,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
    });

    props.appsyncApi.api.grantMutation(fetchFromCarSFNCreate, 'createStartFetchFromCarDbEntry');

    const write_to_dynamo = new stepFunctionsTasks.LambdaInvoke(this, 'Write Fetch Request to DynamoDB', {
      lambdaFunction: fetchFromCarSFNCreate,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
    });

    // Invoke
    const fetchFromCarSFNInvoke = new StandardLambdaPythonFunction(this, 'fetchFromCarSFNInvoke', {
      entry: 'lib/lambdas/car_logs_fetch_from_car_stepfunction_invoke',
      description: 'car_logs_fetch_from_car_stepfunction_invoke',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_logs_fetch_from_car_stepfunction_invoke',
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
        BAG_UPLOAD_S3_BUCKET: bagUploadBucket.bucketName,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
    });

    fetchFromCarSFNInvoke.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:SendCommand'],
        resources: ['*'],
      })
    );
    // permissions for s3 bucket write
    bagUploadBucket.grantWrite(fetchFromCarSFNInvoke, 'upload/*');

    props.appsyncApi.api.grantMutation(fetchFromCarSFNInvoke, 'updateFetchFromCarDbEntry');

    const invokeWithSsm = new stepFunctionsTasks.LambdaInvoke(this, 'Invoke fetch from car via SSM', {
      lambdaFunction: fetchFromCarSFNInvoke,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
      resultPath: '$.ssmCommandId',
      resultSelector: { 'ssmCommandId.$': '$.Payload.ssmCommandId' },
    });

    // Status
    const fetchFromCarSFNStatus = new StandardLambdaPythonFunction(this, 'fetchFromCarSFNStatus', {
      entry: 'lib/lambdas/car_logs_fetch_from_car_stepfunction_status',
      description: 'car_logs_fetch_from_car_stepfunction_status',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_logs_fetch_from_car_stepfunction_status',
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
    });

    fetchFromCarSFNStatus.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'],
      })
    );

    props.appsyncApi.api.grantMutation(fetchFromCarSFNStatus, 'updateFetchFromCarDbEntry');

    const statusWithSsm = new stepFunctionsTasks.LambdaInvoke(this, 'Status of fetch from car via SSM', {
      lambdaFunction: fetchFromCarSFNStatus,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
      resultPath: '$.status',
      resultSelector: { 'status.$': '$.Payload.status' },
    });

    // passToSsm
    const passToSsm = new stepFunctions.Pass(this, 'passToSsm', {
      parameters: {
        carInstanceId: stepFunctions.JsonPath.stringAt('$.Payload.carInstanceId'),
        carName: stepFunctions.JsonPath.stringAt('$.Payload.carName'),
        carFleetId: stepFunctions.JsonPath.stringAt('$.Payload.carFleetId'),
        carFleetName: stepFunctions.JsonPath.stringAt('$.Payload.carFleetName'),
        carIpAddress: stepFunctions.JsonPath.stringAt('$.Payload.carIpAddress'),
        eventId: stepFunctions.JsonPath.stringAt('$.Payload.eventId'),
        eventName: stepFunctions.JsonPath.stringAt('$.Payload.eventName'),
        jobId: stepFunctions.JsonPath.stringAt('$.Payload.jobId'),
        laterThan: stepFunctions.JsonPath.stringAt('$.Payload.laterThan'),
      },
      resultPath: '$',
    });

    const passToSsmWait = new stepFunctions.Wait(this, 'passToSsmWait', {
      time: stepFunctions.WaitTime.duration(Duration.seconds(1)),
    });

    const passToSsmChoice = new stepFunctions.Choice(this, 'passToSsmChoice');
    const condition1 = stepFunctions.Condition.stringEquals('$.status.status', 'InProgress');
    const condition2 = stepFunctions.Condition.stringEquals('$.status.status', 'Pending');
    const finish = new stepFunctions.Pass(this, 'Finish');

    const passToSsmChoiceDefinition = passToSsmChoice
      .when(stepFunctions.Condition.or(condition1, condition2), passToSsmWait)
      .otherwise(finish);

    // passToSsm definition
    passToSsm.next(invokeWithSsm.next(passToSsmWait).next(statusWithSsm).next(passToSsmChoiceDefinition));

    // Start Wait
    const startWait = new stepFunctions.Wait(this, 'startWait', {
      time: stepFunctions.WaitTime.duration(Duration.seconds(1)),
    });

    // Definition
    const definition = startWait.next(write_to_dynamo).next(passToSsm);

    this.stepFunction = new stepFunctions.StateMachine(this, 'CarStatusUpdater', {
      definition: definition,
      tracingEnabled: true,
      timeout: Duration.minutes(10),
      /*logs: {
        destination: car_status_update_SM_log_group,
        level: stepFunctions.LogLevel.ALL,
      },*/
    });

    // AppSync //

    // AppSync Objects
    const startFetchFromCarType = new ObjectType('StartFetchFromCar', {
      definition: {
        jobId: GraphqlType.string(),
      },
      directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(startFetchFromCarType);

    const fetchFromCarJobType = new ObjectType('FetchFromCarJob', {
      definition: {
        carInstanceId: GraphqlType.string(),
        carName: GraphqlType.string(),
        carFleetId: GraphqlType.string(),
        carFleetName: GraphqlType.string(),
        carIpAddress: GraphqlType.string(),
        eventId: GraphqlType.id(),
        eventName: GraphqlType.string(),
        jobId: GraphqlType.id(),
        laterThan: GraphqlType.awsDateTime(),
        startTime: GraphqlType.awsDateTime(),
        fetchStartTime: GraphqlType.awsDateTime(),
        status: GraphqlType.string(),
        endTime: GraphqlType.awsDateTime(),
      },
      directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(fetchFromCarJobType);

    // car_logs_fetch_from_car_appsync_handler
    const fetchLogsToCarAppSyncHandler = new StandardLambdaPythonFunction(this, 'fetchLogsToCarAppSyncHandler', {
      entry: 'lib/lambdas/car_logs_fetch_from_car_appsync_handler/',
      description: 'Triggers the car_logs_fetch_from_car_appsync_handler Step Function and returns the execution/jobId',
      runtime: props.lambdaConfig.runtime,
      architecture: props.lambdaConfig.architecture,
      environment: {
        STEP_FUNCTION_ARN: this.stepFunction.stateMachineArn,
        POWERTOOLS_SERVICE_NAME: 'car_logs_fetch_from_car_appsync_handler',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        DDB_TABLE: fetchJobsTable.tableName,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],
    });

    fetchLogsToCarAppSyncHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['states:StartExecution'],
        resources: [this.stepFunction.stateMachineArn],
      })
    );

    fetchLogsToCarAppSyncHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [fetchJobsTable.tableArn, fetchJobsTable.tableArn + '/index/eventId'],
      })
    );

    const fetchFromCarDataSource = props.appsyncApi.api.addLambdaDataSource(
      'fetchFromCarDataSource',
      fetchLogsToCarAppSyncHandler
    );

    props.appsyncApi.schema.addMutation(
      'startFetchFromCar',
      new ResolvableField({
        args: {
          carInstanceId: GraphqlType.string(),
          carName: GraphqlType.string(),
          carFleetId: GraphqlType.string(),
          carFleetName: GraphqlType.string(),
          carIpAddress: GraphqlType.string(),
          eventId: GraphqlType.id(),
          eventName: GraphqlType.string(),
          laterThan: GraphqlType.awsDateTime(),
        },
        returnType: startFetchFromCarType.attribute(),
        dataSource: fetchFromCarDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'createStartFetchFromCarDbEntry',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id(),
          carInstanceId: GraphqlType.string(),
          carName: GraphqlType.string(),
          carFleetId: GraphqlType.string(),
          carFleetName: GraphqlType.string(),
          carIpAddress: GraphqlType.string(),
          eventId: GraphqlType.id(),
          eventName: GraphqlType.string(),
          laterThan: GraphqlType.awsDateTime(),
          startTime: GraphqlType.awsDateTime(),
          status: GraphqlType.string(),
        },
        returnType: fetchFromCarJobType.attribute(),
        dataSource: fetchFromCarDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'updateFetchFromCarDbEntry',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id(),
          status: GraphqlType.string(),
          eventId: GraphqlType.id(),
          endTime: GraphqlType.awsDateTime(),
          fetchStartTime: GraphqlType.awsDateTime(),
        },
        returnType: fetchFromCarJobType.attribute(),
        dataSource: fetchFromCarDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addQuery(
      'listFetchesFromCar',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id(),
          eventId: GraphqlType.id(),
        },
        returnType: fetchFromCarJobType.attribute({ isList: true }),
        dataSource: fetchFromCarDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onFetchesFromCarCreated',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id(),
          eventId: GraphqlType.id(),
        },
        returnType: fetchFromCarJobType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('createStartFetchFromCarDbEntry'), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onFetchesFromCarUpdated',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id(),
          eventId: GraphqlType.id(),
        },
        returnType: fetchFromCarJobType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('updateFetchFromCarDbEntry'), Directive.cognito('admin', 'operator')],
      })
    );
  }
}
