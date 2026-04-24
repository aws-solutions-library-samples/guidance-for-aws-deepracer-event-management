import { CfnResource, DockerImage, Duration, RemovalPolicy, Size, Stack } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { IEventBus, Match, Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { EventBridgeDestination } from 'aws-cdk-lib/aws-lambda-destinations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { CodeFirstSchema } from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';

import { Trigger } from 'aws-cdk-lib/triggers';
import { Construct } from 'constructs';
import { StandardLambdaDockerImageFuncion } from './standard-lambda-docker-image-function';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

interface ClamscanServerlessProps {
  uploadBucket: s3.IBucket;
  scannedBucked: s3.IBucket;
  logsBucket: s3.IBucket;
  account: string;
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
      appsyncHelpersLayer: lambda.ILayerVersion;
      powerToolsLayer: lambda.ILayerVersion;
    };
  };
  eventbus: IEventBus;
}

export class ClamscanServerless extends Construct {
  public readonly postLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ClamscanServerlessProps) {
    super(scope, id);

    const CONTAINER_DEFINITIONS_PATH = '/tmp/clamav';

    // S3 Bucket for library files
    const libraryBucket = new s3.Bucket(this, 'clamscan-library', {
      encryption: s3.BucketEncryption.S3_MANAGED, // TODO change to KMS encryption CMK
      serverAccessLogsBucket: props.logsBucket,
      serverAccessLogsPrefix: 'access-logs/clamscan_library/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const updateLambda = new StandardLambdaDockerImageFuncion(this, 'ClamscanUpdateFunction', {
      description: 'Update ClamAV definitions',
      code: lambda.DockerImageCode.fromImageAsset('lib/lambdas/clamscan_update', {
        platform: Platform.LINUX_AMD64,
      }),
      timeout: Duration.minutes(15),
      architecture: lambda.Architecture.X86_64,
      memorySize: 1024,
      environment: {
        DEFS_BUCKET: libraryBucket.bucketName,
        CONTAINER_DEFINITIONS_PATH: CONTAINER_DEFINITIONS_PATH,
      },
    });

    new Rule(this, 'UpdateVirusDefinitionRule', {
      schedule: Schedule.rate(Duration.hours(12)),
      targets: [new LambdaFunction(updateLambda)],
    });

    const downloadTrigger = new Trigger(this, 'initializeVirusDefinitions', {
      handler: updateLambda,
      timeout: Duration.minutes(15),
      executeAfter: [updateLambda],
    });

    const scanLambda = new StandardLambdaDockerImageFuncion(this, 'ClamscanFunction', {
      description: 'Scan uploaded files',
      code: lambda.DockerImageCode.fromImageAsset('lib/lambdas/clamscan_scan', {
        platform: Platform.LINUX_AMD64,
      }),
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(5),
      memorySize: 3072,
      ephemeralStorageSize: Size.gibibytes(2),
      reservedConcurrentExecutions: 20,
      onSuccess: new EventBridgeDestination(props.eventbus),
      //onFailure: new EventBridgeDestination(event_bus),
      retryAttempts: 2,
      environment: {
        LIBRARY_BUCKET: libraryBucket.bucketName,
        CONTAINER_DEFINITIONS_PATH: CONTAINER_DEFINITIONS_PATH,
      },
    });

    scanLambda.node.addDependency(downloadTrigger);

    const postLambda = new StandardLambdaPythonFunction(this, 'clamscanPostFunction', {
      description: 'Moves scanned files to final or infected bucket',
      entry: 'lib/lambdas/clamscan_post',
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      onSuccess: new EventBridgeDestination(props.eventbus),
      environment: {
        POWERTOOLS_SERVICE_NAME: 'clamscanPostFunction',
        DESTINATION_BUCKET: props.scannedBucked.bucketName,
        INFECTED_BUCKET: props.scannedBucked.bucketName,
        BUCKET_OWNER: props.account,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      layers: [props.lambdaConfig.layersConfig.powerToolsLayer, props.lambdaConfig.layersConfig.appsyncHelpersLayer],
    });
    props.appsyncApi.api.grantMutation(postLambda, 'updateModel');

    this.postLambda = postLambda;

    // trigger lambda to run on s3 upload
    const uploadRule = new Rule(this, 'ModelUploadRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [props.uploadBucket.bucketName],
          },
        },
      },
    });

    uploadRule.addTarget(
      new LambdaFunction(scanLambda, {
        maxEventAge: Duration.minutes(30),
        retryAttempts: 2,
      })
    );

    // trigger lambda to run on successful lambda invocation
    const postRule = new Rule(this, 'ClamscanPostRule', {
      eventPattern: {
        source: ['lambda'],
        detailType: ['Lambda Function Invocation Result - Success'],
        resources: Match.prefix(scanLambda.functionArn),
      },
      eventBus: props.eventbus,
    });

    postRule.addTarget(
      new LambdaFunction(postLambda, {
        retryAttempts: 2,
      })
    );

    libraryBucket.grantReadWrite(updateLambda);
    libraryBucket.grantRead(scanLambda);

    props.uploadBucket.grantRead(scanLambda);
    props.uploadBucket.grantReadWrite(postLambda);

    props.scannedBucked.grantWrite(postLambda);

    const libraryBucketLogicalId = Stack.of(this).getLogicalId(libraryBucket.node.defaultChild as CfnResource);
    const uploadBucketLogicalId = Stack.of(this).getLogicalId(props.uploadBucket.node.defaultChild as CfnResource);
    const scannedBucketLogicalId = Stack.of(this).getLogicalId(props.scannedBucked.node.defaultChild as CfnResource);

    NagSuppressions.addResourceSuppressions(
      updateLambda.role!,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'S3 grantReadWrite produces wildcard actions and bucket-level resource ARNs; required for the ClamAV update function to read and write virus definitions to the library bucket.',
          appliesTo: [
            'Action::s3:Abort*',
            'Action::s3:DeleteObject*',
            'Action::s3:GetBucket*',
            'Action::s3:GetObject*',
            'Action::s3:List*',
            `Resource::<${libraryBucketLogicalId}.Arn>/*`,
          ],
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      scanLambda.role!,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'S3 grant methods (grantRead) produce wildcard actions and bucket-level resource ARNs; required for ClamAV to scan files in the library and upload buckets.',
          appliesTo: [
            'Action::s3:GetBucket*',
            'Action::s3:GetObject*',
            'Action::s3:List*',
            `Resource::<${libraryBucketLogicalId}.Arn>/*`,
            `Resource::<${uploadBucketLogicalId}.Arn>/*`,
          ],
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      postLambda.role!,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'S3 grant methods (grantReadWrite, grantWrite) produce wildcard actions and bucket-level resource ARNs; required for ClamAV post-scan function to move files between upload and scanned buckets.',
          appliesTo: [
            'Action::s3:Abort*',
            'Action::s3:DeleteObject*',
            'Action::s3:GetBucket*',
            'Action::s3:GetObject*',
            'Action::s3:List*',
            `Resource::<${uploadBucketLogicalId}.Arn>/*`,
            `Resource::<${scannedBucketLogicalId}.Arn>/*`,
          ],
        },
      ],
      true
    );
  }
}
