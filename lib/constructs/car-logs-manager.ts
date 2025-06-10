import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3notify from 'aws-cdk-lib/aws-s3-notifications';
import {
  CodeFirstSchema,
  Directive,
  EnumType,
  GraphqlType,
  InputType,
  ObjectType,
  ResolvableField,
} from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';
import path = require('path');

import { CarLogsFetchStepFunction } from './car-logs-fetch';

const MAX_VCPU = 32;
const MAX_JOB_VCPU = MAX_VCPU / 2;

export interface CarLogsManagerProps {
  logsBucket: s3.IBucket;
  modelsBucket: s3.IBucket;
  appsyncApi: {
    schema: CodeFirstSchema;
    api: appsync.GraphqlApi;
    noneDataSource: appsync.NoneDataSource;
  };
  lambdaConfig: {
    runtime: lambda.Runtime;
    architecture: lambda.Architecture;
    bundlingImage: cdk.DockerImage;
    layersConfig: {
      powerToolsLogLevel: string;
      helperFunctionsLayer: lambda.ILayerVersion;
      appsyncHelpersLayer: lambda.ILayerVersion;
      powerToolsLayer: lambda.ILayerVersion;
    };
  };
  eventbus: EventBus;
}

export class CarLogsManager extends Construct {
  public readonly bagUploadBucket: s3.Bucket;
  public readonly carLogsBucket: s3.Bucket;
  public readonly assetsTable: dynamodb.Table;
  public readonly vpc: ec2.IVpc;
  public readonly jobQueue: batch.CfnJobQueue;
  public readonly jobDefinition: batch.CfnJobDefinition;

  constructor(scope: Construct, id: string, props: CarLogsManagerProps) {
    super(scope, id);

    const sharedLambdaRole = new iam.Role(this, 'SharedLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    const cloudWatchLogsPermissionsPolicy = new iam.Policy(this, 'CloudWatch', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['logs:DescribeLogGroups'],
          resources: [`arn:aws:logs:${region}:${account}:log-group:/aws/lambda/*${id}*`], // Allow access to log groups with the specific prefix
        }),
      ],
    });
    sharedLambdaRole.attachInlinePolicy(cloudWatchLogsPermissionsPolicy);

    // Use dedicated VPC
    this.vpc = new ec2.Vpc(this, 'LogsVPC', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'private',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 24,
          name: 'public',
          subnetType: SubnetType.PUBLIC,
        },
      ],
    });

    // Create the upload bucket
    this.bagUploadBucket = new s3.Bucket(this, 'upload', {
      encryption: s3.BucketEncryption.S3_MANAGED, // TODO change to KMS encryption CMK
      serverAccessLogsBucket: props.logsBucket,
      serverAccessLogsPrefix: 'access-logs/car_logs_upload_bucket/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      eventBridgeEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        { expiration: Duration.days(15), tagFilters: { lifecycle: 'true' } },
        { abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
    });

    const corsRule = {
      allowedHeaders: ['*'],
      allowedMethods: [
        s3.HttpMethods.PUT,
        s3.HttpMethods.POST,
        s3.HttpMethods.GET,
        s3.HttpMethods.HEAD,
        s3.HttpMethods.DELETE,
      ],
      allowedOrigins: [
        '*',
        // "http://localhost:3000",
        // "https://" + distribution.distribution_domain_name
      ],
      exposedHeaders: ['x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2', 'x-amz-version-id', 'ETag'],
      maxAge: 3000,
    };
    this.bagUploadBucket.addCorsRule(corsRule);

    // Use existing bucket or create new one for output
    this.carLogsBucket = new s3.Bucket(this, 'assets', {
      encryption: s3.BucketEncryption.S3_MANAGED, // TODO change to KMS encryption CMK
      serverAccessLogsBucket: props.logsBucket,
      serverAccessLogsPrefix: 'access-logs/car_logs_bucket/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      eventBridgeEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      lifecycleRules: [
        { expiration: Duration.days(60), tagFilters: { lifecycle: 'true' } },
        { abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
    });
    this.carLogsBucket.addCorsRule(corsRule);

    // Use existing table or create new one
    this.assetsTable = new dynamodb.Table(this, 'AssetsTable', {
      partitionKey: {
        name: 'sub',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'assetId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const OPERATOR_ASSETS_GSI_NAME = 'operatorAssetsIndexV2';
    this.assetsTable.addGlobalSecondaryIndex({
      indexName: OPERATOR_ASSETS_GSI_NAME,
      partitionKey: {
        name: 'gsiAvailableForOperator',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'gsiUploadedTimestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add this before your job definition
    const dockerImage = new ecr_assets.DockerImageAsset(this, 'VideoProcessorImage', {
      directory: path.join(__dirname, '../docker/video_processor'), // Adjust path to your Dockerfile location
      buildArgs: {
        AWS_REGION: cdk.Stack.of(this).region,
      },
    });

    // Create security group for Batch
    const batchSG = new ec2.SecurityGroup(this, 'BatchSG', {
      vpc: this.vpc,
      description: 'Security group for Batch compute environment',
      allowAllOutbound: true,
    });

    // Create IAM roles
    const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole')],
    });

    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    });

    const taskLogGroup = new cdk.aws_logs.LogGroup(this, 'CarLogsProcessor', {
      retention: cdk.aws_logs.RetentionDays.SIX_MONTHS,
    });

    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    });

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [taskLogGroup.logGroupArn],
      })
    );

    // Grant permissions to task role
    this.carLogsBucket.grantReadWrite(taskRole);
    props.modelsBucket.grantRead(taskRole);
    props.appsyncApi.api.grantMutation(taskRole, 'addCarLogsAsset');

    // Create Batch compute environment
    const computeEnv = new batch.CfnComputeEnvironment(this, 'ComputeEnv', {
      type: 'MANAGED',
      state: 'ENABLED',
      computeResources: {
        type: 'FARGATE',
        maxvCpus: MAX_VCPU,
        subnets: this.vpc.selectSubnets({ subnetType: SubnetType.PUBLIC }).subnetIds,
        securityGroupIds: [batchSG.securityGroupId],
      },
      serviceRole: batchServiceRole.roleArn,
    });

    // Create job queue
    this.jobQueue = new batch.CfnJobQueue(this, 'JobQueue', {
      priority: 1,
      state: 'ENABLED',
      computeEnvironmentOrder: [
        {
          computeEnvironment: computeEnv.ref,
          order: 1,
        },
      ],
    });

    // Create job definition
    this.jobDefinition = new batch.CfnJobDefinition(this, 'JobDefinition', {
      type: 'container',
      platformCapabilities: ['FARGATE'],
      containerProperties: {
        image: dockerImage.imageUri,
        fargatePlatformConfiguration: {
          platformVersion: 'LATEST',
        },
        resourceRequirements: [
          { type: 'VCPU', value: MAX_JOB_VCPU.toString() },
          { type: 'MEMORY', value: '32768' },
        ],
        executionRoleArn: taskExecutionRole.roleArn,
        jobRoleArn: taskRole.roleArn,
        networkConfiguration: {
          assignPublicIp: 'ENABLED',
        },
        environment: [
          { name: 'LOG_LEVEL', value: props.lambdaConfig.layersConfig.powerToolsLogLevel },
          { name: 'LOGS_BUCKET', value: this.carLogsBucket.bucketName },
          { name: 'MODELS_BUCKET', value: props.modelsBucket.bucketName },
          { name: 'APPSYNC_URL', value: props.appsyncApi.api.graphqlUrl },
          { name: 'CODEC', value: 'avc1' },
          { name: 'SKIP_DURATION', value: '5.0' },
          { name: 'RELATIVE_LABELS', value: 'true' },
        ],
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': taskLogGroup.logGroupName,
            'awslogs-region': cdk.Stack.of(this).region,
            'awslogs-stream-prefix': 'logs-processor',
          },
        },
      },
      timeout: {
        attemptDurationSeconds: 7200, // 2 hour timeout
      },
    });

    // Create Lambda function for processing uploaded logs
    const processorFunction = new StandardLambdaPythonFunction(this, 'ProcessBatchOfBags', {
      runtime: props.lambdaConfig.runtime,
      architecture: props.lambdaConfig.architecture,
      entry: 'lib/lambdas/car_logs_processor/',
      memorySize: 1024,
      timeout: Duration.minutes(15),
      role: sharedLambdaRole,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'ProcessBatchOfBags',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        BAGS_UPLOAD_BUCKET: this.bagUploadBucket.bucketName,
        OUTPUT_BUCKET: this.carLogsBucket.bucketName,
        JOB_QUEUE: this.jobQueue.ref,
        JOB_DEFINITION: this.jobDefinition.ref,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
      ],
      cloudWatchPolicy: cloudWatchLogsPermissionsPolicy,
    });

    // Grant permissions to Lambda
    this.bagUploadBucket.grantReadWrite(sharedLambdaRole);
    this.carLogsBucket.grantReadWrite(sharedLambdaRole);
    props.appsyncApi.api.grantQuery(sharedLambdaRole, 'listCars');
    props.appsyncApi.api.grantQuery(sharedLambdaRole, 'getAllModels');
    props.appsyncApi.api.grantQuery(sharedLambdaRole, 'listUsers');
    props.appsyncApi.api.grantMutation(sharedLambdaRole, 'addCarLogsAsset');

    // Grant permission to submit Batch jobs
    sharedLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['batch:SubmitJob'],
        resources: [this.jobQueue.attrJobQueueArn, this.jobDefinition.ref],
      })
    );

    // Add S3 trigger
    this.bagUploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notify.LambdaDestination(processorFunction),
      { prefix: 'manual_upload/', suffix: '.tar.gz' }
    );

    const assetsOnDeleteHandler = new StandardLambdaPythonFunction(this, 'AssetsOnDeleteHandler', {
      entry: 'lib/lambdas/car_logs_on_delete/',
      description:
        'Generates a deleteCarLogsAsset mutation to delete the asset in the db as well as pushing update to FE',
      runtime: props.lambdaConfig.runtime,
      architecture: props.lambdaConfig.architecture,
      role: sharedLambdaRole,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'car_logs_on_delete',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
      ],
      cloudWatchPolicy: cloudWatchLogsPermissionsPolicy,
    });

    const deleteLambdaFctS3ObjectDeleteRule = new Rule(this, 'DeleteLambdaFctS3ObjectDeleteRule', {
      description: 'Calls Lambda function for assets deleted from S3',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Deleted'],
        detail: {
          bucket: {
            name: [this.carLogsBucket.bucketName],
          },
        },
      },
      targets: [new LambdaFunction(assetsOnDeleteHandler)],
    });

    props.appsyncApi.api.grantMutation(sharedLambdaRole, 'deleteCarLogsAsset');

    // Create Lambda function for the CarLogs API
    const carLogsAssetHandler = new StandardLambdaPythonFunction(this, 'ApiFunction', {
      entry: 'lib/lambdas/car_logs_api/',
      description: 'CarLogs Asset API resolver',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      environment: {
        DDB_TABLE: this.assetsTable.tableName,
        ASSETS_BUCKET: this.carLogsBucket.bucketName,
        OPERATOR_ASSETS_GSI_NAME: OPERATOR_ASSETS_GSI_NAME,
        POWERTOOLS_SERVICE_NAME: 'CarLogs Asset API resolver',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],
      cloudWatchPolicy: cloudWatchLogsPermissionsPolicy,
    });
    this.carLogsBucket.grantRead(carLogsAssetHandler);
    this.assetsTable.grantReadWriteData(carLogsAssetHandler);

    // Define the data source for the API
    const carLogsAssetDataSource = props.appsyncApi.api.addLambdaDataSource(
      'CarLogsAssetDataSource',
      carLogsAssetHandler
    );

    NagSuppressions.addResourceSuppressions(
      carLogsAssetDataSource,
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

    // GraphQL API
    const carLogsAssetType = new EnumType('CarLogsAssetTypeEnum', {
      definition: ['BAG_SQLITE', 'BAG_MCAP', 'VIDEO', 'NONE'],
    });
    props.appsyncApi.schema.addType(carLogsAssetType);

    const assetMetadataObjectType = new ObjectType('AssetMetadata', {
      definition: {
        key: GraphqlType.string(),
        filename: GraphqlType.string(),
        uploadedDateTime: GraphqlType.awsDateTime(),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator')], // TODO anyone who is logged in should have access to this
    });

    props.appsyncApi.schema.addType(assetMetadataObjectType);

    const assetMetadataInputType = new InputType('AssetMetadataInput', {
      definition: {
        key: GraphqlType.string(),
        filename: GraphqlType.string(),
        uploadedDateTime: GraphqlType.awsDateTime(),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator')], // TODO anyone who is logged in should have access to this
    });

    props.appsyncApi.schema.addType(assetMetadataInputType);

    const mediaMetadataObjectType = new ObjectType('MediaMetadata', {
      definition: {
        duration: GraphqlType.float(),
        codec: GraphqlType.string(),
        fps: GraphqlType.float(),
        resolution: GraphqlType.string(),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator')], // TODO anyone who is logged in should have access to this
    });
    props.appsyncApi.schema.addType(mediaMetadataObjectType);

    const mediaMetadataInputType = new InputType('MediaMetadataInput', {
      definition: {
        duration: GraphqlType.float(),
        codec: GraphqlType.string(),
        fps: GraphqlType.float(),
        resolution: GraphqlType.string(),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator')], // TODO anyone who is logged in should have access to this
    });
    props.appsyncApi.schema.addType(mediaMetadataInputType);

    const carLogsModelRef = new ObjectType('CarLogsModelRef', {
      definition: {
        modelId: GraphqlType.string({ isRequired: true }),
        modelName: GraphqlType.string({ isRequired: true }),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator', 'commentator')],
    });
    props.appsyncApi.schema.addType(carLogsModelRef);

    const carLogsAssetObjectType = new ObjectType('CarLogsAsset', {
      definition: {
        assetId: GraphqlType.id({ isRequired: true }),
        sub: GraphqlType.id({ isRequired: true }),
        username: GraphqlType.string({ isRequired: true }),
        models: carLogsModelRef.attribute({ isList: true }),
        eventId: GraphqlType.string(),
        eventName: GraphqlType.string(),
        fetchJobId: GraphqlType.string(),
        carName: GraphqlType.string(),
        assetMetaData: assetMetadataObjectType.attribute(),
        mediaMetaData: mediaMetadataObjectType.attribute(),
        type: carLogsAssetType.attribute({ isRequired: true }),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator', 'commentator')], // TODO anyone who is logged in should have access to this
    });

    props.appsyncApi.schema.addType(carLogsAssetObjectType);

    const carLogsAssetObjectPagination = new ObjectType('CarLogsAssetPagination', {
      definition: {
        assets: carLogsAssetObjectType.attribute({ isList: true }),
        nextToken: GraphqlType.string(),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator', 'commentator')], // TODO anyone who is logged in should have access to this
    });

    props.appsyncApi.schema.addType(carLogsAssetObjectPagination);
    props.appsyncApi.schema.addQuery(
      'getAllCarLogsAssets',
      new ResolvableField({
        args: {
          user_sub: GraphqlType.string({ isRequired: false }),
          limit: GraphqlType.int({ isRequired: false }),
          nextToken: GraphqlType.string({ isRequired: false }),
        },
        returnType: carLogsAssetObjectPagination.attribute(),
        dataSource: carLogsAssetDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator', 'racer', 'commentator')],
      })
    );

    // Define the CarLogsModelInput type at the schema level
    const carLogsModelInput = new InputType('CarLogsModelInput', {
      definition: {
        modelId: GraphqlType.string({ isRequired: true }),
        modelName: GraphqlType.string({ isRequired: true }),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator', 'commentator')],
    });
    props.appsyncApi.schema.addType(carLogsModelInput);

    props.appsyncApi.schema.addMutation(
      'addCarLogsAsset',
      new ResolvableField({
        args: {
          assetId: GraphqlType.id({ isRequired: true }),
          sub: GraphqlType.id({ isRequired: true }),
          username: GraphqlType.string(),
          models: carLogsModelInput.attribute({ isList: true }),
          eventId: GraphqlType.string(),
          eventName: GraphqlType.string(),
          fetchJobId: GraphqlType.string(),
          carName: GraphqlType.string(),
          assetMetaData: assetMetadataInputType.attribute(),
          mediaMetaData: mediaMetadataInputType.attribute(),
          type: carLogsAssetType.attribute(),
        },
        returnType: carLogsAssetObjectType.attribute(),
        dataSource: carLogsAssetDataSource,
        directives: [Directive.iam()],
      })
    );

    props.appsyncApi.schema.addMutation(
      'deleteCarLogsAsset',
      new ResolvableField({
        args: {
          assetId: GraphqlType.id({ isRequired: true }),
          sub: GraphqlType.id(),
        },
        returnType: carLogsAssetObjectType.attribute(),
        dataSource: carLogsAssetDataSource,
        directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator')],
      })
    );

    const carLogsAssetsDownloadLinksType = new ObjectType('CarLogsAssetsDownloadLinks', {
      definition: {
        assetId: GraphqlType.id({ isRequired: true }),
        downloadLink: GraphqlType.string({ isRequired: true }),
      },
    });
    props.appsyncApi.schema.addType(carLogsAssetsDownloadLinksType);

    const carLogsAssetSubPairsInput = new InputType('CarLogsAssetSubPairsInput', {
      definition: {
        assetId: GraphqlType.id({ isRequired: true }),
        sub: GraphqlType.id({ isRequired: true }),
      },
    });
    props.appsyncApi.schema.addType(carLogsAssetSubPairsInput);

    props.appsyncApi.schema.addQuery(
      'getCarLogsAssetsDownloadLinks',
      new ResolvableField({
        args: {
          assetSubPairs: carLogsAssetSubPairsInput.attribute({ isRequired: true, isList: true }),
        },
        returnType: carLogsAssetsDownloadLinksType.attribute({ isList: true }),
        dataSource: carLogsAssetDataSource,
        directives: [Directive.cognito('racer', 'admin', 'operator')],
      })
    );

    // Allow users in operator or admin groups to subscribe to all model updates
    // Allow users not in these groups to subscribe only to their own model updates
    const subscriptionPermissions = `
        #set($groups = $context.identity.claims.get("cognito:groups"))
        #set($isOperator = false)

        #foreach($group in $groups)
            #if($group == "operator" || $group == "admin")
                #set($isOperator = true)
            #end
        #end

        #if($context.identity.sub == $context.args.sub)
            {
            "version": "2018-05-29",
            "payload": $util.toJson($context.arguments.entry)
        }
        #elseif($isOperator == true)
            {
            "version": "2018-05-29",
            "payload": $util.toJson($context.arguments.entry)
        }
        #else
            $utils.unauthorized()
        #end
        `;

    props.appsyncApi.schema.addSubscription(
      'onAddedCarLogsAsset',
      new ResolvableField({
        args: {
          sub: GraphqlType.id(),
        },
        returnType: carLogsAssetObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(subscriptionPermissions),
        responseMappingTemplate: appsync.MappingTemplate.fromString(
          `
            $util.toJson($context.result)
            `
        ),
        directives: [Directive.subscribe('addCarLogsAsset')], // , Directive.cognito('admin')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onDeletedCarLogsAsset',
      new ResolvableField({
        args: {
          sub: GraphqlType.id(),
        },
        returnType: carLogsAssetObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(subscriptionPermissions),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('deleteCarLogsAsset')],
      })
    );

    // Create Step Function for fetching logs
    new CarLogsFetchStepFunction(
      this,
      'FetchLogs',
      this.bagUploadBucket,
      processorFunction,
      this.jobQueue,
      sharedLambdaRole,
      cloudWatchLogsPermissionsPolicy,
      {
        appsyncApi: props.appsyncApi,
        lambdaConfig: props.lambdaConfig,
      }
    );

    // Add tags
    cdk.Tags.of(this).add('Purpose', 'CarLogsProcessing');
  }
}
