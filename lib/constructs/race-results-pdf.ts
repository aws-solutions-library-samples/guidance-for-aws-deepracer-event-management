import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
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
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

export interface RaceResultsPdfProps {
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
      powerToolsLayer: lambda.ILayerVersion;
    };
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

    // ---------- WeasyPrint layer ----------
    const weasyprintLayer = new lambda.LayerVersion(this, 'WeasyPrintLayer', {
      code: lambda.Code.fromDockerBuild('lib/lambda_layers/weasyprint', { imagePath: '/asset-output' }),
      compatibleArchitectures: [props.lambdaConfig.architecture],
      compatibleRuntimes: [props.lambdaConfig.runtime],
      description: 'WeasyPrint + native deps (cairo, pango, gdk-pixbuf) for PDF rendering',
    });

    // ---------- Lambda ----------
    const pdfLambda = new StandardLambdaPythonFunction(this, 'pdfLambda', {
      entry: 'lib/lambdas/pdf_api/',
      description: 'Race results PDF generator',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(2),
      runtime: props.lambdaConfig.runtime,
      memorySize: 512,
      architecture: props.lambdaConfig.architecture,
      bundling: { image: props.lambdaConfig.bundlingImage },
      layers: [
        weasyprintLayer,
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
      ],
      environment: {
        PDF_BUCKET: pdfBucket.bucketName,
        RACE_TABLE: props.raceTable.tableName,
        EVENTS_TABLE: props.eventsTable.tableName,
        USER_POOL_ID: props.userPoolId,
        URL_EXPIRY_SECONDS: '3600',
        POWERTOOLS_SERVICE_NAME: 'pdf_api',
        // Force /opt/lib onto LD_LIBRARY_PATH. Lambda's python3.12 runtime
        // is supposed to do this automatically but WeasyPrint's dlopen was
        // failing to find libpango-1.0-0.so even though it's present in
        // the layer — set it explicitly as a belt-and-braces fix.
        LD_LIBRARY_PATH: '/opt/lib:/var/runtime:/var/task/lib:/usr/lib64:/lib64',
        FONTCONFIG_PATH: '/opt/lib/fontconfig',
      },
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
