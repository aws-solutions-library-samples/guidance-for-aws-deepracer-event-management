import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as stepFunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepFunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Directive, GraphqlType, InputType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';
import { Construct } from 'constructs';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

export class CarUploadStepFunction extends Construct {
  readonly stepFunction: stepFunctions.StateMachine;

  constructor(scope: Construct, id: string, modelsBucket: s3.Bucket, props: any) {
    super(scope, id);

    const uploadJobsTable = new dynamodb.Table(this, 'CarUploadJobTable', {
      partitionKey: {
        name: 'jobId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'modelKey',
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

    uploadJobsTable.addGlobalSecondaryIndex(globalSecondaryIndexProps);

    // Create
    const uploadToCarSFNCreate = new StandardLambdaPythonFunction(this, 'uploadToCarSFNCreate', {
      entry: 'lib/lambdas/upload_model_to_car_stepfunction_create',
      description: 'upload_model_to_car_stepfunction_create',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'upload_model_to_car_stepfunction_create',
        DDB_TABLE: uploadJobsTable.tableName,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
    });

    props.appsyncApi.api.grantMutation(uploadToCarSFNCreate, 'createStartUploadToCarDbEntry');

    const write_to_dynamo = new stepFunctionsTasks.LambdaInvoke(this, 'Write Upload Request to DynamoDB', {
      lambdaFunction: uploadToCarSFNCreate,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
    });

    const mapToDynamo = new stepFunctions.Map(this, 'mapToDynamo', {
      maxConcurrency: 1,
      itemsPath: stepFunctions.JsonPath.stringAt('$.modelData'),
      itemSelector: {
        carInstanceId: stepFunctions.JsonPath.stringAt('$.carInstanceId'),
        carName: stepFunctions.JsonPath.stringAt('$.carName'),
        carFleetId: stepFunctions.JsonPath.stringAt('$.carFleetId'),
        carFleetName: stepFunctions.JsonPath.stringAt('$.carFleetName'),
        carIpAddress: stepFunctions.JsonPath.stringAt('$.carIpAddress'),
        eventId: stepFunctions.JsonPath.stringAt('$.eventId'),
        eventName: stepFunctions.JsonPath.stringAt('$.eventName'),
        modelKey: stepFunctions.JsonPath.stringAt('$$.Map.Item.Value.modelKey'),
        username: stepFunctions.JsonPath.stringAt('$$.Map.Item.Value.username'),
        jobId: stepFunctions.JsonPath.stringAt('$.jobId'),
      },
      resultPath: '$.mapOutput',
    });
    mapToDynamo.itemProcessor(write_to_dynamo);

    // Invoke
    const uploadToCarSFNInvoke = new StandardLambdaPythonFunction(this, 'uploadToCarSFNInvoke', {
      entry: 'lib/lambdas/upload_model_to_car_stepfunction_invoke',
      description: 'upload_model_to_car_stepfunction_invoke',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'upload_model_to_car_stepfunction_invoke',
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
        MODELS_S3_BUCKET: modelsBucket.bucketName,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
    });

    uploadToCarSFNInvoke.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:SendCommand'],
        resources: ['*'],
      })
    );
    // permissions for s3 bucket read
    modelsBucket.grantRead(uploadToCarSFNInvoke, 'private/*');

    props.appsyncApi.api.grantMutation(uploadToCarSFNInvoke, 'updateUploadToCarDbEntry');

    const invokeWithSsm = new stepFunctionsTasks.LambdaInvoke(this, 'Invoke upload to car via SSM', {
      lambdaFunction: uploadToCarSFNInvoke,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
      resultPath: '$.ssmCommandId',
      resultSelector: { 'ssmCommandId.$': '$.Payload.ssmCommandId' },
    });

    // Status
    const uploadToCarSFNStatus = new StandardLambdaPythonFunction(this, 'uploadToCarSFNStatus', {
      entry: 'lib/lambdas/upload_model_to_car_stepfunction_status',
      description: 'upload_model_to_car_stepfunction_status',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'upload_model_to_car_stepfunction_status',
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
    });

    uploadToCarSFNStatus.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'],
      })
    );

    props.appsyncApi.api.grantMutation(uploadToCarSFNStatus, 'updateUploadToCarDbEntry');

    const statusWithSsm = new stepFunctionsTasks.LambdaInvoke(this, 'Status of upload to car via SSM', {
      lambdaFunction: uploadToCarSFNStatus,
      payload: stepFunctions.TaskInput.fromObject({
        data: stepFunctions.JsonPath.stringAt('$'),
        executionArn: stepFunctions.JsonPath.stringAt('$$.Execution.Id'),
      }),
      resultPath: '$.status',
      resultSelector: { 'status.$': '$.Payload.status' },
    });

    // mapToSsm
    const mapToSsm = new stepFunctions.Map(this, 'mapToSsm', {
      maxConcurrency: 1,
      itemsPath: stepFunctions.JsonPath.stringAt('$.modelData'),
      itemSelector: {
        carInstanceId: stepFunctions.JsonPath.stringAt('$.carInstanceId'),
        carName: stepFunctions.JsonPath.stringAt('$.carName'),
        carFleetId: stepFunctions.JsonPath.stringAt('$.carFleetId'),
        carFleetName: stepFunctions.JsonPath.stringAt('$.carFleetName'),
        carIpAddress: stepFunctions.JsonPath.stringAt('$.carIpAddress'),
        eventId: stepFunctions.JsonPath.stringAt('$.eventId'),
        eventName: stepFunctions.JsonPath.stringAt('$.eventName'),
        modelKey: stepFunctions.JsonPath.stringAt('$$.Map.Item.Value.modelKey'),
        username: stepFunctions.JsonPath.stringAt('$$.Map.Item.Value.username'),
        jobId: stepFunctions.JsonPath.stringAt('$.jobId'),
      },
      resultPath: '$.mapOutput',
    });

    const mapToSsmWait = new stepFunctions.Wait(this, 'mapToSsmWait', {
      time: stepFunctions.WaitTime.duration(Duration.seconds(1)),
    });

    const mapToSsmChoice = new stepFunctions.Choice(this, 'mapToSsmChoice');
    const condition1 = stepFunctions.Condition.stringEquals('$.status.status', 'InProgress');
    const condition2 = stepFunctions.Condition.stringEquals('$.status.status', 'Pending');
    const finish = new stepFunctions.Pass(this, 'Finish');

    const mapToSsmChoiceDefinition = mapToSsmChoice
      .when(stepFunctions.Condition.or(condition1, condition2), mapToSsmWait)
      .otherwise(finish);

    // mapToSsm definition
    mapToSsm.itemProcessor(invokeWithSsm.next(mapToSsmWait).next(statusWithSsm).next(mapToSsmChoiceDefinition));

    // Start Wait
    const startWait = new stepFunctions.Wait(this, 'startWait', {
      time: stepFunctions.WaitTime.duration(Duration.seconds(1)),
    });

    // Definition
    const definition = startWait.next(mapToDynamo).next(mapToSsm);

    this.stepFunction = new stepFunctions.StateMachine(this, 'CarStatusUpdater', {
      definitionBody: stepFunctions.DefinitionBody.fromChainable(definition),
      tracingEnabled: true,
      timeout: Duration.minutes(10),
      /*logs: {
        destination: car_status_update_SM_log_group,
        level: stepFunctions.LogLevel.ALL,
      },*/
    });

    // AppSync //

    // AppSync Objects
    const startUploadToCarType = new ObjectType('StartUploadToCar', {
      definition: {
        jobId: GraphqlType.string(),
      },
      directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(startUploadToCarType);

    const uploadToCarJobType = new ObjectType('UploadToCarJob', {
      definition: {
        carInstanceId: GraphqlType.string(),
        carName: GraphqlType.string(),
        carFleetId: GraphqlType.string(),
        carFleetName: GraphqlType.string(),
        carIpAddress: GraphqlType.string(),
        eventId: GraphqlType.id(),
        eventName: GraphqlType.string(),
        modelKey: GraphqlType.string(),
        username: GraphqlType.string(),
        jobId: GraphqlType.id(),
        startTime: GraphqlType.awsDateTime(),
        uploadStartTime: GraphqlType.awsDateTime(),
        status: GraphqlType.string(),
        endTime: GraphqlType.awsDateTime(),
      },
      directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(uploadToCarJobType);

    // upload_model_to_car_appsync_handler
    const uploadModelToCarAppSyncHandler = new StandardLambdaPythonFunction(this, 'uploadModelToCarAppSyncHandler', {
      entry: 'lib/lambdas/upload_model_to_car_appsync_handler/',
      description: 'Triggers the upload_model_to_car_appsync_handler Step Function and returns the execution/jobId',
      runtime: props.lambdaConfig.runtime,
      architecture: props.lambdaConfig.architecture,
      environment: {
        STEP_FUNCTION_ARN: this.stepFunction.stateMachineArn,
        POWERTOOLS_SERVICE_NAME: 'upload_model_to_car_appsync_handler',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        DDB_TABLE: uploadJobsTable.tableName,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],
    });

    uploadModelToCarAppSyncHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['states:StartExecution'],
        resources: [this.stepFunction.stateMachineArn],
      })
    );

    uploadModelToCarAppSyncHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [uploadJobsTable.tableArn, uploadJobsTable.tableArn + '/index/eventId'],
      })
    );

    const uploadToCarDataSource = props.appsyncApi.api.addLambdaDataSource(
      'uploadToCarDataSource',
      uploadModelToCarAppSyncHandler
    );

    const modelDataInputType = new InputType('modelData', {
      definition: {
        modelKey: GraphqlType.string(),
        username: GraphqlType.string(),
      },
      directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(modelDataInputType);

    props.appsyncApi.schema.addMutation(
      'startUploadToCar',
      new ResolvableField({
        args: {
          carInstanceId: GraphqlType.string(),
          carName: GraphqlType.string(),
          carFleetId: GraphqlType.string(),
          carFleetName: GraphqlType.string(),
          carIpAddress: GraphqlType.string(),
          eventId: GraphqlType.id(),
          eventName: GraphqlType.string(),
          modelData: modelDataInputType.attribute({ isList: true }),
        },
        returnType: startUploadToCarType.attribute(),
        dataSource: uploadToCarDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'createStartUploadToCarDbEntry',
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
          modelKey: GraphqlType.string(),
          username: GraphqlType.string(),
          startTime: GraphqlType.awsDateTime(),
          status: GraphqlType.string(),
        },
        returnType: uploadToCarJobType.attribute(),
        dataSource: uploadToCarDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'updateUploadToCarDbEntry',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id(),
          modelKey: GraphqlType.string(),
          status: GraphqlType.string(),
          eventId: GraphqlType.id(),
          endTime: GraphqlType.awsDateTime(),
          uploadStartTime: GraphqlType.awsDateTime(),
        },
        returnType: uploadToCarJobType.attribute(),
        dataSource: uploadToCarDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addQuery(
      'listUploadsToCar',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id(),
          eventId: GraphqlType.id(),
        },
        returnType: uploadToCarJobType.attribute({ isList: true }),
        dataSource: uploadToCarDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onUploadsToCarCreated',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id(),
          eventId: GraphqlType.id(),
        },
        returnType: uploadToCarJobType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('createStartUploadToCarDbEntry'), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onUploadsToCarUpdated',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id(),
          eventId: GraphqlType.id(),
        },
        returnType: uploadToCarJobType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('updateUploadToCarDbEntry'), Directive.cognito('admin', 'operator')],
      })
    );
  }
}
