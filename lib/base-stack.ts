import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import * as awsLambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Cdn } from './constructs/cdn';
import { Eventbridge } from './constructs/eventbridge';
import { Idp } from './constructs/idp';
import { Website } from './constructs/website';

export interface BaseStackProps extends cdk.StackProps {
    email: string;
}

const powertoolsLogLevel = 'INFO';

export class BaseStack extends cdk.Stack {
    public readonly eventbridge: Eventbridge;
    public readonly idp: Idp;
    public readonly cloudfrontDistribution: Distribution;
    public readonly logsBucket: s3.Bucket;
    public readonly lambdaConfig: {
        runtime: awsLambda.Runtime;
        architecture: awsLambda.Architecture;
        bundlingImage: DockerImage;
        layersConfig: {
            helperFunctionsLayer: awsLambda.ILayerVersion;
            powerToolsLayer: awsLambda.ILayerVersion;
            powerToolsLogLevel: string;
        };
    };
    public readonly dremWebsitebucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: BaseStackProps) {
        super(scope, id, props);

        const stack = cdk.Stack.of(this);

        const logsBucket = new s3.Bucket(this, 'logsBucket', {
            encryption: s3.BucketEncryption.S3_MANAGED,
            serverAccessLogsPrefix: 'access-logs/logsBucket/', // TODO is this causing a delete issue??
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            lifecycleRules: [
                { expiration: Duration.days(30) },
                { abortIncompleteMultipartUploadAfter: Duration.days(1) },
            ],
        });
        this.logsBucket = logsBucket;
        logsBucket.policy?.document.addStatements(
            new cdk.aws_iam.PolicyStatement({
                sid: 'AllowSSLRequestsOnly',
                effect: cdk.aws_iam.Effect.DENY,
                principals: [new cdk.aws_iam.AnyPrincipal()],
                actions: ['s3:*'],
                resources: [logsBucket.bucketArn, logsBucket.bucketArn + '/*'],
                conditions: { NumericLessThan: { 's3:TlsVersion': '1.2' } },
            })
        );

        // Cloudfront resources for serving multiple pages via the same distribution
        const dremWebsite = new Website(this, 'DremWebSite', {
            logsBucket: logsBucket,
        });

        this.dremWebsitebucket = dremWebsite.sourceBucket;

        //  cloudfront Distribution
        const cdn = new Cdn(this, 'cdn', {
            defaultOrigin: dremWebsite.origin,
            logsBucket: logsBucket,
        });
        this.cloudfrontDistribution = cdn.distribution;

        // Terms And Conditions webpage
        new Website(this, 'TermsNConditions', {
            contentPath: './website-terms-and-conditions/',
            pathPattern: '/terms-and-conditions.html',
            logsBucket: logsBucket,
            cdnDistribution: cdn.distribution,
        });

        // Lambda
        // Common Config
        const lambda_architecture = awsLambda.Architecture.ARM_64;
        const lambda_runtime = awsLambda.Runtime.PYTHON_3_9;
        const lambda_bundling_image = DockerImage.fromRegistry(
            'public.ecr.aws/sam/build-python3.9:latest-arm64'
        );

        // Layers
        const helperFunctionsLayer = new lambdaPython.PythonLayerVersion(this, 'helper_functions', {
            entry: 'lib/lambdas/helper_functions_layer/http_response/',
            compatibleArchitectures: [lambda_architecture],
            compatibleRuntimes: [lambda_runtime],
            bundling: { image: lambda_bundling_image },
        });

        // Powertools layer
        const powertoolsLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(
            this,
            'lambda_powertools',
            `arn:aws:lambda:${stack.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:11`
        );

        this.lambdaConfig = {
            architecture: lambda_architecture,
            runtime: lambda_runtime,
            bundlingImage: lambda_bundling_image,
            layersConfig: {
                helperFunctionsLayer: helperFunctionsLayer,
                powerToolsLayer: powertoolsLayer,
                powerToolsLogLevel: powertoolsLogLevel,
            },
        };

        // Event Bus
        this.eventbridge = new Eventbridge(this, 'eventbridge');

        // Cognito Resources
        this.idp = new Idp(this, 'idp', {
            distribution: cdn.distribution,
            defaultAdminEmail: props.email,
            lambdaConfig: this.lambdaConfig,
            eventbus: this.eventbridge.eventbus,
        });
    }
}
