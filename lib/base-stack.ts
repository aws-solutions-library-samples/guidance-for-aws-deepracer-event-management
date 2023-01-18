import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as awsLambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Website } from './constructs/website';

import { Idp } from './constructs/idp';


export interface BaseStackProps extends cdk.StackProps {
  email: string
}

const powertoolsLogLevel = "INFO"

export class BaseStack extends cdk.Stack {
  public readonly idp: Idp;
  public readonly cloudfrontDistribution: cloudfront.Distribution;
  public readonly logsBucket: s3.Bucket;
  public readonly lambdaConfig: {
    runtime: awsLambda.Runtime,
    architecture: awsLambda.Architecture,
    bundlingImage: DockerImage,
    layersConfig: {
      helperFunctionsLayer: awsLambda.ILayerVersion,
      powerToolsLayer: awsLambda.ILayerVersion
      powerToolsLogLevel: string,
    }
  }
  public readonly dremWebsitebucket: s3.Bucket

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

    const stack = cdk.Stack.of(this)

    const logsBucket = new s3.Bucket(this, "logsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsPrefix: "access-logs/logsBucket/",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        { expiration: Duration.days(30) },
        {abortIncompleteMultipartUploadAfter: Duration.days(1)}
      ]
    })

    logsBucket.policy!.document.addStatements(
      new cdk.aws_iam.PolicyStatement({
        sid: "AllowSSLRequestsOnly",
        effect: cdk.aws_iam.Effect.DENY,
        principals: [new cdk.aws_iam.AnyPrincipal],
        actions: ["s3:*"],
        resources: [
            logsBucket.bucketArn,
            logsBucket.bucketArn + "/*",
        ],
        conditions: {"NumericLessThan": {"s3:TlsVersion": "1.2"}},
      })
    )

    // Drem website infra need to be created here since a disribution
    // need a default_behaviour to be created
    const dremWebsite = new Website(this, 'DremWebSite', {
      logsBucket: logsBucket,
    })

    //  cloudfront Distribution
    const cloudfrontDistribution = new cloudfront.Distribution(this, 'distribution', {
      defaultBehavior: {
        origin: dremWebsite.origin,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      logBucket: logsBucket,
      logFilePrefix: "access-logs/cf_distribution/",
      errorResponses: [{ httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" }, {httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/errors/404.html"}]
    })

    this.cloudfrontDistribution = cloudfrontDistribution

    // Lambda
    // Common Config
    const lambda_architecture = awsLambda.Architecture.ARM_64
    const lambda_runtime = awsLambda.Runtime.PYTHON_3_9
    const lambda_bundling_image = DockerImage.fromRegistry("public.ecr.aws/sam/build-python3.9:latest-arm64")

    // Layers
    const helperFunctionsLayer = new lambdaPython.PythonLayerVersion(this, 'helper_functions', {
      entry: "lib/lambdas/helper_functions_layer/http_response/",
      compatibleArchitectures: [lambda_architecture],
      compatibleRuntimes: [lambda_runtime],
      bundling: {image: lambda_bundling_image}
    })

    // Powertools layer
    const powertoolsLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(this, 'lambda_powertools', `arn:aws:lambda:${stack.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:11`)

    this.lambdaConfig = {
      architecture: lambda_architecture,
      runtime: lambda_runtime,
      bundlingImage: lambda_bundling_image,
      layersConfig: {
        helperFunctionsLayer: helperFunctionsLayer,
        powerToolsLayer: powertoolsLayer,
        powerToolsLogLevel: powertoolsLogLevel
      }
    }
    // Cognito Resources
    this.idp = new Idp(this, "idp", {distribution: cloudfrontDistribution, defaultAdminEmail: props.email})
  }
}
