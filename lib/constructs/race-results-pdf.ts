import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import {
  CodeFirstSchema,
  Directive,
  EnumType,
  GraphqlType,
  ObjectType,
  ResolvableField,
} from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface RaceResultsPdfProps {
  appsyncApi: {
    schema: CodeFirstSchema;
    api: appsync.GraphqlApi;
    noneDataSource: appsync.NoneDataSource;
  };
  lambdaConfig: {
    architecture: lambda.Architecture;
  };
  userPoolId: string;
  userPoolArn: string;
  raceTable: dynamodb.ITable;
  eventsTable: dynamodb.ITable;
  logsBucket: IBucket;
}

export class RaceResultsPdf extends Construct {
  constructor(scope: Construct, id: string, props: RaceResultsPdfProps) {
    super(scope, id);

    // ---------- S3 bucket ----------
    const pdfBucket = new s3.Bucket(this, 'PdfBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: props.logsBucket,
      serverAccessLogsPrefix: 'access-logs/race-results-pdf/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    pdfBucket.addLifecycleRule({ enabled: true, expiration: Duration.days(1) });

    // ---------- DynamoDB PdfJobs table ----------
    const pdfJobsTable = new dynamodb.Table(this, 'PdfJobsTable', {
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---------- Lambda container image (shared by 3 functions) ----------
    // Shipped as a container image rather than a zip + layer because
    // WeasyPrint's native deps (cairo, pango, gdk-pixbuf) are painful to
    // package as a Lambda layer — cffi's dlopen doesn't play nicely with
    // LD_LIBRARY_PATH for libraries that aren't registered with ldconfig.
    // A container image lets dnf install them normally, so the dynamic
    // linker just works.
    const imagePath = 'lib/lambdas/pdf_api';
    const platform = ecrAssetsPlatformFor(props.lambdaConfig.architecture);

    const sharedEnv = {
      PDF_BUCKET: pdfBucket.bucketName,
      RACE_TABLE: props.raceTable.tableName,
      EVENTS_TABLE: props.eventsTable.tableName,
      USER_POOL_ID: props.userPoolId,
      URL_EXPIRY_SECONDS: '3600',
      PDF_JOBS_TABLE: pdfJobsTable.tableName,
      APPSYNC_ENDPOINT: props.appsyncApi.api.graphqlUrl,
      APPSYNC_REGION: this.node.tryGetContext('region') ?? 'eu-west-1',
      // Point fontconfig's cache at /tmp (Lambda's only writable dir). Without
      // this it tries to write to /var/cache/fontconfig or $HOME/.cache —
      // neither writable on Lambda — and re-scans every font on every render.
      XDG_CACHE_HOME: '/tmp',
      HOME: '/tmp',
    };

    // Worker: long-running renderer (invoked async by orchestrator)
    const workerLambda = new lambda.DockerImageFunction(this, 'WorkerLambda', {
      code: lambda.DockerImageCode.fromImageAsset(imagePath, {
        platform,
        cmd: ['worker.lambda_handler'],
      }),
      architecture: props.lambdaConfig.architecture,
      timeout: Duration.minutes(15),
      memorySize: 1024,
      description: 'Race results PDF worker (async renderer)',
      logRetention: logs.RetentionDays.SIX_MONTHS,
      environment: {
        ...sharedEnv,
        POWERTOOLS_SERVICE_NAME: 'pdf_worker',
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Orchestrator: AppSync resolver for generateRaceResultsPdf
    const orchestratorLambda = new lambda.DockerImageFunction(this, 'OrchestratorLambda', {
      code: lambda.DockerImageCode.fromImageAsset(imagePath, {
        platform,
        cmd: ['index.lambda_handler'],
      }),
      architecture: props.lambdaConfig.architecture,
      timeout: Duration.seconds(30),
      memorySize: 512,
      description: 'Race results PDF orchestrator (AppSync resolver)',
      logRetention: logs.RetentionDays.SIX_MONTHS,
      environment: {
        ...sharedEnv,
        WORKER_FUNCTION_NAME: workerLambda.functionName,
        POWERTOOLS_SERVICE_NAME: 'pdf_orchestrator',
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // getPdfJob: resolver returning a fresh pre-signed URL per call
    const getPdfJobLambda = new lambda.DockerImageFunction(this, 'GetPdfJobLambda', {
      code: lambda.DockerImageCode.fromImageAsset(imagePath, {
        platform,
        cmd: ['get_pdf_job.lambda_handler'],
      }),
      architecture: props.lambdaConfig.architecture,
      timeout: Duration.seconds(10),
      memorySize: 256,
      description: 'Race results getPdfJob resolver',
      logRetention: logs.RetentionDays.SIX_MONTHS,
      environment: {
        ...sharedEnv,
        POWERTOOLS_SERVICE_NAME: 'pdf_get_job',
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // ---------- IAM grants ----------
    // Orchestrator: PDF bucket R/W (future use), jobs table write, worker invoke
    pdfBucket.grantReadWrite(orchestratorLambda);
    pdfJobsTable.grantWriteData(orchestratorLambda);
    workerLambda.grantInvoke(orchestratorLambda);

    // Worker: PDF bucket R/W, jobs table read, race/events read, cognito lookup,
    // appsync mutate updatePdfJob only
    pdfBucket.grantReadWrite(workerLambda);
    pdfJobsTable.grantReadData(workerLambda);
    props.raceTable.grantReadData(workerLambda);
    props.eventsTable.grantReadData(workerLambda);
    workerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:ListUsers'],
        resources: [props.userPoolArn],
      })
    );
    workerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['appsync:GraphQL'],
        resources: [`${props.appsyncApi.api.arn}/types/Mutation/fields/updatePdfJob`],
      })
    );

    // getPdfJob: jobs table read, PDF bucket read (for presigned URL generation)
    pdfBucket.grantRead(getPdfJobLambda);
    pdfJobsTable.grantReadData(getPdfJobLambda);

    // ---------- AppSync schema ----------
    const pdfTypeEnum = new EnumType('PdfType', {
      definition: ['ORGANISER_SUMMARY', 'PODIUM', 'RACER_CERTIFICATE', 'RACER_CERTIFICATES_BULK'],
    });
    props.appsyncApi.schema.addType(pdfTypeEnum);

    const pdfResultType = new ObjectType('PdfGenerationResult', {
      definition: {
        downloadUrl: GraphqlType.string({ isRequired: true }),
        filename: GraphqlType.string({ isRequired: true }),
        expiresAt: GraphqlType.awsDateTime({ isRequired: true }),
      },
      directives: [Directive.cognito('admin', 'operator', 'commentator', 'racer')],
    });
    props.appsyncApi.schema.addType(pdfResultType);

    // ---------- AppSync data sources ----------
    const orchestratorDataSource = props.appsyncApi.api.addLambdaDataSource(
      'PdfOrchestratorDataSource',
      orchestratorLambda
    );
    const getPdfJobDataSource = props.appsyncApi.api.addLambdaDataSource(
      'PdfGetJobDataSource',
      getPdfJobLambda
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const pdfJobsDdbDataSource = props.appsyncApi.api.addDynamoDbDataSource(
      'PdfJobsDdbDataSource',
      pdfJobsTable
    );

    NagSuppressions.addResourceSuppressions(
      [orchestratorDataSource, getPdfJobDataSource],
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress wildcard that covers Lambda aliases in resource path',
          appliesTo: [{ regex: '/^Resource::(.+):\\*$/g' }],
        },
      ],
      true
    );

    props.appsyncApi.schema.addMutation(
      'generateRaceResultsPdf',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          type: pdfTypeEnum.attribute({ isRequired: true }),
          userId: GraphqlType.id(),
          trackId: GraphqlType.id(),
        },
        returnType: pdfResultType.attribute(),
        dataSource: orchestratorDataSource,
        directives: [Directive.cognito('admin', 'operator', 'commentator', 'racer')],
      })
    );
  }
}

// Translate a CDK lambda.Architecture into the ecr-assets Platform string.
// `lambda.DockerImageCode.fromImageAsset` needs `platform: Platform.LINUX_ARM64`
// etc. but the CDK architecture enum uses `Architecture.ARM_64`.
function ecrAssetsPlatformFor(arch: lambda.Architecture) {
  // Lazy-import to keep the top of the file tidy.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Platform } = require('aws-cdk-lib/aws-ecr-assets');
  return arch === lambda.Architecture.ARM_64 ? Platform.LINUX_ARM64 : Platform.LINUX_AMD64;
}
