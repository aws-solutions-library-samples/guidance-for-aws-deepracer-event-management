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
  racerProfileTable: dynamodb.ITable;
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
      RACER_PROFILE_TABLE: props.racerProfileTable.tableName,
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

    // ---------- IAM grants ----------
    // Orchestrator: PDF bucket R/W (future use), jobs table read+write, worker invoke.
    // Read on the jobs table is needed for the getPdfJob query resolver, which
    // is served by the same Lambda (dispatched by AppSync field name).
    pdfBucket.grantReadWrite(orchestratorLambda);
    pdfJobsTable.grantWriteData(orchestratorLambda);
    pdfJobsTable.grantReadData(orchestratorLambda);
    workerLambda.grantInvoke(orchestratorLambda);

    // Worker: PDF bucket R/W, jobs table read, race/events read, cognito lookup,
    // appsync mutate updatePdfJob only
    pdfBucket.grantReadWrite(workerLambda);
    pdfJobsTable.grantReadData(workerLambda);
    props.raceTable.grantReadData(workerLambda);
    props.eventsTable.grantReadData(workerLambda);
    props.racerProfileTable.grantReadData(workerLambda);
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

    // ---------- AppSync schema ----------
    const pdfTypeEnum = new EnumType('PdfType', {
      definition: ['ORGANISER_SUMMARY', 'PODIUM', 'RACER_CERTIFICATE', 'RACER_CERTIFICATES_BULK'],
    });
    props.appsyncApi.schema.addType(pdfTypeEnum);

    const pdfJobStatusEnum = new EnumType('PdfJobStatus', {
      definition: ['PENDING', 'SUCCESS', 'FAILED'],
    });
    props.appsyncApi.schema.addType(pdfJobStatusEnum);

    const pdfJobType = new ObjectType('PdfJob', {
      definition: {
        jobId: GraphqlType.id({ isRequired: true }),
        status: pdfJobStatusEnum.attribute({ isRequired: true }),
        type: pdfTypeEnum.attribute({ isRequired: true }),
        eventId: GraphqlType.id({ isRequired: true }),
        userId: GraphqlType.id(),
        trackId: GraphqlType.id(),
        filename: GraphqlType.string(),
        downloadUrl: GraphqlType.string(),
        error: GraphqlType.string(),
        createdBy: GraphqlType.id({ isRequired: true }),
        createdAt: GraphqlType.awsDateTime({ isRequired: true }),
        completedAt: GraphqlType.awsDateTime(),
      },
      directives: [
        Directive.cognito('admin', 'operator', 'commentator', 'racer'),
        Directive.iam(),
      ],
    });
    props.appsyncApi.schema.addType(pdfJobType);

    // ---------- AppSync data sources ----------
    const orchestratorDataSource = props.appsyncApi.api.addLambdaDataSource(
      'PdfOrchestratorDataSource',
      orchestratorLambda
    );

    NagSuppressions.addResourceSuppressions(
      [orchestratorDataSource],
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress wildcard that covers Lambda aliases in resource path',
          appliesTo: [{ regex: '/^Resource::(.+):\\*$/g' }],
        },
      ],
      true
    );

    // The orchestrator + worker Lambdas both need broad S3 R/W on the PdfBucket
    // (CDK's grantReadWrite expands to s3:GetObject*, PutObject*, GetBucket*,
    // List*, DeleteObject*, Abort* with the bucket ARN + /*). Same pattern as
    // other DREM Lambdas that own their bucket. Resource::* is the X-Ray-tracing
    // default policy which requires it. Lambda-invoke wildcard covers versions/
    // aliases of the worker function.
    const lambdaIamSuppressions = [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Broad S3 actions scoped to the PdfBucket this construct owns',
        appliesTo: [
          'Action::s3:Abort*',
          'Action::s3:DeleteObject*',
          'Action::s3:GetBucket*',
          'Action::s3:GetObject*',
          'Action::s3:List*',
          { regex: '/^Resource::<RaceResultsPdfPdfBucket[A-Z0-9]+\\.Arn>/\\*$/g' },
        ],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'X-Ray tracing needs Resource::* to write trace segments',
        appliesTo: ['Resource::*'],
      },
    ];
    NagSuppressions.addResourceSuppressions(
      [orchestratorLambda, workerLambda],
      lambdaIamSuppressions,
      true
    );
    // The orchestrator also invokes the worker — IAM5 wildcard covers versions/aliases.
    NagSuppressions.addResourceSuppressions(
      orchestratorLambda,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard covers worker Lambda versions/aliases in the invoke permission',
          appliesTo: [{ regex: '/^Resource::<RaceResultsPdfWorkerLambda[A-Z0-9]+\\.Arn>:\\*$/g' }],
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
        returnType: pdfJobType.attribute(),
        dataSource: orchestratorDataSource,
        directives: [Directive.cognito('admin', 'operator', 'commentator', 'racer')],
      })
    );

    // updatePdfJob — IAM-only. Worker calls this after render completes (or fails).
    // Triggers onPdfJobUpdated subscription via @aws_subscribe side effect.
    // Served by the orchestrator Lambda (single handler for all PDF AppSync fields)
    // rather than a dedicated DDB data source — the latter cost 3 CFN resources
    // and we're close to the 500-resource stack cap.
    props.appsyncApi.schema.addMutation(
      'updatePdfJob',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id({ isRequired: true }),
          status: pdfJobStatusEnum.attribute({ isRequired: true }),
          s3Key: GraphqlType.string(),
          filename: GraphqlType.string(),
          error: GraphqlType.string(),
        },
        returnType: pdfJobType.attribute(),
        dataSource: orchestratorDataSource,
        directives: [Directive.iam()],
      })
    );

    // ---------- AppSync schema: queries ----------
    props.appsyncApi.schema.addQuery(
      'getPdfJob',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id({ isRequired: true }),
        },
        returnType: pdfJobType.attribute(),
        dataSource: orchestratorDataSource,
        directives: [Directive.cognito('admin', 'operator', 'commentator', 'racer')],
      })
    );

    // ---------- AppSync schema: subscriptions ----------
    props.appsyncApi.schema.addSubscription(
      'onPdfJobUpdated',
      new ResolvableField({
        args: {
          jobId: GraphqlType.id({ isRequired: true }),
        },
        returnType: pdfJobType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(`{
          "version": "2017-02-28",
          "payload": $util.toJson($context.arguments.entry)
        }`),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [
          Directive.subscribe('updatePdfJob'),
          Directive.cognito('admin', 'operator', 'commentator', 'racer'),
        ],
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

