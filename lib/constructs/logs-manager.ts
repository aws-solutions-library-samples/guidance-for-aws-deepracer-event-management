import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3notify from 'aws-cdk-lib/aws-s3-notifications';
import { CodeFirstSchema } from 'awscdk-appsync-utils';
import { Construct } from 'constructs';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';
import path = require('path');

const MAX_VCPU = 8;

export interface LogsManagerProps {
  logsBucket: s3.IBucket;
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

export class LogsManager extends Construct {
  public readonly bagUploadBucket: s3.Bucket;
  public readonly videoOutputBucket: s3.Bucket;
  public readonly logsTable: dynamodb.Table;
  public readonly vpc: ec2.IVpc;
  public readonly jobQueue: batch.CfnJobQueue;
  public readonly jobDefinition: batch.CfnJobDefinition;

  constructor(scope: Construct, id: string, props: LogsManagerProps) {
    super(scope, id);

    // Use existing VPC or create new one
    this.vpc = new ec2.Vpc(this, 'LogsVPC', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Use existing bucket or create new one for logs
    this.bagUploadBucket = new s3.Bucket(this, 'bag-upload-bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED, // TODO change to KMS encryption CMK
      serverAccessLogsBucket: props.logsBucket,
      serverAccessLogsPrefix: 'access-logs/upload_bucket/',
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
      exposedHeaders: ['x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2', 'ETag'],
      maxAge: 3000,
    };
    this.bagUploadBucket.addCorsRule(corsRule);

    // Use existing bucket or create new one for output
    this.videoOutputBucket = new s3.Bucket(this, 'video-output-bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED, // TODO change to KMS encryption CMK
      serverAccessLogsBucket: props.logsBucket,
      serverAccessLogsPrefix: 'access-logs/models_bucket/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      eventBridgeEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      lifecycleRules: [
        { expiration: Duration.days(15), tagFilters: { lifecycle: 'true' } },
        { abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
    });

    // Use existing table or create new one
    this.logsTable = new dynamodb.Table(this, 'LogsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // Add this before your job definition
    const dockerImage = new ecr_assets.DockerImageAsset(this, 'VideoProcessorImage', {
      directory: path.join(__dirname, '../docker/video_processor'), // Adjust path to your Dockerfile location
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

    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant permissions to task role
    this.bagUploadBucket.grantRead(taskRole);
    this.videoOutputBucket.grantWrite(taskRole);
    this.logsTable.grantReadWriteData(taskRole);

    // Create Batch compute environment
    const computeEnv = new batch.CfnComputeEnvironment(this, 'ComputeEnv', {
      type: 'MANAGED',
      state: 'ENABLED',
      computeResources: {
        type: 'FARGATE_SPOT', // Changed to use Spot instances
        maxvCpus: MAX_VCPU,
        subnets: this.vpc.privateSubnets.map((subnet) => subnet.subnetId),
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
          { type: 'VCPU', value: MAX_VCPU.toString() },
          { type: 'MEMORY', value: '16384' },
        ],
        executionRoleArn: taskExecutionRole.roleArn,
        jobRoleArn: taskRole.roleArn,
        networkConfiguration: {
          assignPublicIp: 'DISABLED',
        },
        environment: [
          { name: 'LOGS_TABLE', value: this.logsTable.tableName },
          { name: 'OUTPUT_BUCKET', value: this.videoOutputBucket.bucketName },
        ],
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': `/aws/batch/logs-processor`,
            'awslogs-region': cdk.Stack.of(this).region,
            'awslogs-stream-prefix': 'logs-processor',
          },
        },
      },
    });

    // Create Lambda function for processing uploaded logs
    const processorFunction = new StandardLambdaPythonFunction(this, 'processBatchOfBags', {
      runtime: props.lambdaConfig.runtime,
      architecture: props.lambdaConfig.architecture,
      entry: 'lib/lambdas/logs_processor/',
      memorySize: 1024,
      timeout: Duration.minutes(15),
      environment: {
        POWERTOOLS_SERVICE_NAME: 'processBatchOfBags',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        LOGS_TABLE: this.logsTable.tableName,
        BAGS_UPLOAD_BUCKET: this.bagUploadBucket.bucketName,
        OUTPUT_BUCKET: this.videoOutputBucket.bucketName,
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
    });

    // Grant permissions to Lambda
    this.bagUploadBucket.grantRead(processorFunction);
    this.videoOutputBucket.grantReadWrite(processorFunction);
    this.logsTable.grantWriteData(processorFunction);
    props.appsyncApi.api.grantQuery(processorFunction, 'carsOnline');

    // Grant permission to submit Batch jobs
    processorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['batch:SubmitJob'],
        resources: [this.jobQueue.attrJobQueueArn, this.jobDefinition.ref],
      })
    );

    // Add S3 trigger
    this.bagUploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notify.LambdaDestination(processorFunction),
      { prefix: 'upload/', suffix: '.tar.gz' }
    );

    // Add tags
    cdk.Tags.of(this).add('Purpose', 'LogsProcessing');
  }
}
