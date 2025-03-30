import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as stepFunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepFunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Directive, EnumType, GraphqlType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';
import { Construct } from 'constructs';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

export class CarLogsFetchStepFunction extends Construct {
  readonly stepFunction: stepFunctions.StateMachine;

  constructor(
    scope: Construct,
    id: string,
    bagUploadBucket: s3.Bucket,
    processorFunction: StandardLambdaPythonFunction,
    jobQueue: batch.CfnJobQueue,
    sharedLambdaRole: iam.Role,
    cloudWatchLogsPermissionsPolicy: iam.Policy,
    props: any
  ) {
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
      role: sharedLambdaRole,
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
      cloudWatchPolicy: cloudWatchLogsPermissionsPolicy,
    });

    props.appsyncApi.api.grantMutation(sharedLambdaRole, 'createStartFetchFromCarDbEntry');

    // Start Wait
    const startWait = new stepFunctions.Wait(this, 'startWait', {
      time: stepFunctions.WaitTime.duration(Duration.seconds(1)),
    });

    const write_to_dynamo = new stepFunctionsTasks.LambdaInvoke(this, 'Write Fetch Request to DynamoDB', {
      lambdaFunction: fetchFromCarSFNCreate,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
      resultPath: '$',
      resultSelector: {
        'carInstanceId.$': '$.Payload.carInstanceId',
        'carName.$': '$.Payload.carName',
        'carFleetId.$': '$.Payload.carFleetId',
        'carFleetName.$': '$.Payload.carFleetName',
        'carIpAddress.$': '$.Payload.carIpAddress',
        'eventId.$': '$.Payload.eventId',
        'eventName.$': '$.Payload.eventName',
        'jobId.$': '$.Payload.jobId',
        'laterThan.$': '$.Payload.laterThan',
        'racerName.$': '$.Payload.racerName',
        'raceData.$': '$.Payload.raceData',
      },
    });

    // Invoke
    const fetchFromCarSFNInvoke = new StandardLambdaPythonFunction(this, 'fetchFromCarSFNInvoke', {
      entry: 'lib/lambdas/car_logs_fetch_from_car_stepfunction_invoke',
      description: 'car_logs_fetch_from_car_stepfunction_invoke',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      role: sharedLambdaRole,
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
      cloudWatchPolicy: cloudWatchLogsPermissionsPolicy,
    });

    sharedLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:SendCommand'],
        resources: ['*'],
      })
    );

    props.appsyncApi.api.grantMutation(sharedLambdaRole, 'updateFetchFromCarDbEntry');

    const invokeWithSsm = new stepFunctionsTasks.LambdaInvoke(this, 'Invoke fetch from car via SSM', {
      lambdaFunction: fetchFromCarSFNInvoke,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
      resultPath: '$.ssm',
      resultSelector: { 'ssmCommandId.$': '$.Payload.ssmCommandId', 'uploadKey.$': '$.Payload.uploadKey' },
    });

    // Status SSM
    const fetchFromCarSFNStatus = new StandardLambdaPythonFunction(this, 'fetchFromCarSFNStatus', {
      entry: 'lib/lambdas/car_logs_fetch_from_car_stepfunction_ssm_status',
      description: 'car_logs_fetch_from_car_stepfunction_ssm_status',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      role: sharedLambdaRole,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_logs_fetch_from_car_stepfunction_ssm_status',
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
      cloudWatchPolicy: cloudWatchLogsPermissionsPolicy,
    });

    sharedLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'],
      })
    );

    const statusWithSsm = new stepFunctionsTasks.LambdaInvoke(this, 'Read SSM Command Status', {
      lambdaFunction: fetchFromCarSFNStatus,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
      resultPath: '$.ssm',
      resultSelector: {
        'status.$': '$.Payload.status',
        'ssmCommandId.$': '$.Payload.ssmCommandId',
        'uploadKey.$': '$.Payload.uploadKey',
      },
    });

    const passToSsmWait = new stepFunctions.Wait(this, 'Wait for SSM', {
      time: stepFunctions.WaitTime.duration(Duration.seconds(1)),
    });

    const passToSsmChoice = new stepFunctions.Choice(this, 'Check if SSM is done');
    const ssmCond1 = stepFunctions.Condition.stringEquals('$.ssm.status', 'InProgress');
    const ssmCond2 = stepFunctions.Condition.stringEquals('$.ssm.status', 'Pending');
    const ssmCond3 = stepFunctions.Condition.stringEquals('$.ssm.status', 'Delayed');
    const ssmCond4 = stepFunctions.Condition.stringEquals('$.ssm.status', 'Success');

    const processorLambdaTask = new stepFunctionsTasks.LambdaInvoke(this, 'Trigger Bag Matching Lambda', {
      lambdaFunction: processorFunction,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
      resultPath: '$.processing',
      resultSelector: { 'matchedBags.$': '$.Payload.body.matched_bags', 'batchJobId.$': '$.Payload.body.batchJobId' },
    });

    // Status SSM
    const videoProcessorStatus = new StandardLambdaPythonFunction(this, 'videoProcessorStatus', {
      entry: 'lib/lambdas/car_logs_fetch_from_car_stepfunction_vp_status',
      description: 'car_logs_fetch_from_car_stepfunction_vp_status',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      role: sharedLambdaRole,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_logs_fetch_from_car_stepfunction_vp_status',
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
        JOB_QUEUE: jobQueue.attrJobQueueArn,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
      cloudWatchPolicy: cloudWatchLogsPermissionsPolicy,
    });

    sharedLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['batch:DescribeJobs'],
        resources: ['*'], //TODO: restrict to something less permissive
      })
    );

    const statusWithBatch = new stepFunctionsTasks.LambdaInvoke(this, 'Read Batch Command Status', {
      lambdaFunction: videoProcessorStatus,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
      resultPath: '$.batch',
      resultSelector: {
        'status.$': '$.Payload.status',
      },
    });

    const passToBatchWait = new stepFunctions.Wait(this, 'Wait for Batch', {
      time: stepFunctions.WaitTime.duration(Duration.seconds(15)),
    });

    const passToBatchChoice = new stepFunctions.Choice(this, 'Check if Batch is done');
    const batchCondFailed = stepFunctions.Condition.stringEquals('$.batch.status', 'FAILED');
    const batchCondSuccess = stepFunctions.Condition.stringEquals('$.batch.status', 'SUCCEEDED');

    const failState = new stepFunctions.Fail(this, 'FailState', {
      error: 'Fetching of logs failed',
      cause: 'The batch process failed.',
    });

    const finish = new stepFunctions.Pass(this, 'Finished');

    const definition = startWait
      .next(write_to_dynamo)
      .next(invokeWithSsm)
      .next(passToSsmWait)
      .next(statusWithSsm)
      .next(
        passToSsmChoice
          .when(stepFunctions.Condition.or(ssmCond1, ssmCond2, ssmCond3), passToSsmWait)
          .when(
            ssmCond4,
            processorLambdaTask
              .next(passToBatchWait)
              .next(statusWithBatch)
              .next(
                passToBatchChoice
                  .when(batchCondSuccess, finish)
                  .when(batchCondFailed, failState)
                  .otherwise(passToBatchWait)
              )
          )
          .otherwise(failState)
      );

    this.stepFunction = new stepFunctions.StateMachine(this, 'StateMachine', {
      definitionBody: stepFunctions.DefinitionBody.fromChainable(definition),
      tracingEnabled: true,
      timeout: Duration.minutes(30),
      /*logs: {
      destination: car_status_update_SM_log_group,
      level: stepFunctions.LogLevel.ALL,
      },*/
    });

    // AppSync //

    // AppSync Objects
    const carLogsFetchStatus = new EnumType('CarLogsFetchStatus', {
      definition: [
        'CREATED',
        'REQUESTED_UPLOAD',
        'WAITING_FOR_UPLOAD',
        'UPLOAD_FAILED',
        'UPLOADED',
        'ANALYZED',
        'QUEUED_FOR_PROCESSING',
        'PROCESSING',
        'DONE',
        'FAILED',
      ],
    });
    props.appsyncApi.schema.addType(carLogsFetchStatus);

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
        racerName: GraphqlType.string(),
        startTime: GraphqlType.awsDateTime(),
        fetchStartTime: GraphqlType.awsDateTime(),
        status: carLogsFetchStatus.attribute(),
        endTime: GraphqlType.awsDateTime(),
        uploadKey: GraphqlType.string(),
        raceData: GraphqlType.awsJson(),
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
      cloudWatchPolicy: cloudWatchLogsPermissionsPolicy,
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
        actions: ['dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
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
          racerName: GraphqlType.string(),
          raceData: GraphqlType.awsJson(),
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
          racerName: GraphqlType.string(),
          startTime: GraphqlType.awsDateTime(),
          status: carLogsFetchStatus.attribute(),
          raceData: GraphqlType.awsJson(),
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
          status: carLogsFetchStatus.attribute(),
          endTime: GraphqlType.awsDateTime(),
          fetchStartTime: GraphqlType.awsDateTime(),
          uploadKey: GraphqlType.string(),
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
