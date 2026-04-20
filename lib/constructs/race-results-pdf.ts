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

    // ---------- Lambda (container image) ----------
    // Shipped as a container image rather than a zip + layer because
    // WeasyPrint's native deps (cairo, pango, gdk-pixbuf) are painful to
    // package as a Lambda layer — cffi's dlopen doesn't play nicely with
    // LD_LIBRARY_PATH for libraries that aren't registered with ldconfig.
    // A container image lets dnf install them normally, so the dynamic
    // linker just works.
    const pdfLambda = new lambda.DockerImageFunction(this, 'pdfLambda', {
      code: lambda.DockerImageCode.fromImageAsset('lib/lambdas/pdf_api', {
        platform: ecrAssetsPlatformFor(props.lambdaConfig.architecture),
      }),
      architecture: props.lambdaConfig.architecture,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      description: 'Race results PDF generator (container image with WeasyPrint)',
      logRetention: logs.RetentionDays.SIX_MONTHS,
      environment: {
        PDF_BUCKET: pdfBucket.bucketName,
        RACE_TABLE: props.raceTable.tableName,
        EVENTS_TABLE: props.eventsTable.tableName,
        USER_POOL_ID: props.userPoolId,
        URL_EXPIRY_SECONDS: '3600',
        POWERTOOLS_SERVICE_NAME: 'pdf_api',
        // Point fontconfig's cache at /tmp (Lambda's only writable dir). Without
        // this it tries to write to /var/cache/fontconfig or $HOME/.cache —
        // neither writable on Lambda — and re-scans every font on every render.
        // First request pays the cache build cost (~1s), warm invocations reuse
        // the cache from /tmp for the life of the container.
        XDG_CACHE_HOME: '/tmp',
        HOME: '/tmp',
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    pdfBucket.grantReadWrite(pdfLambda);
    props.raceTable.grantReadData(pdfLambda);
    props.eventsTable.grantReadData(pdfLambda);
    pdfLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:ListUsers'],
        resources: [props.userPoolArn],
      })
    );

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

    const pdfDataSource = props.appsyncApi.api.addLambdaDataSource('PdfDataSource', pdfLambda);
    NagSuppressions.addResourceSuppressions(
      pdfDataSource,
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
        dataSource: pdfDataSource,
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
