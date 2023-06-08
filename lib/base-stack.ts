import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import * as awsLambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
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
    public readonly tacSourceBucket: s3.Bucket;
    public readonly tacCloudfrontDistribution: Distribution;
    public readonly logsBucket: s3.Bucket;
    public readonly lambdaConfig: {
        runtime: awsLambda.Runtime;
        architecture: awsLambda.Architecture;
        bundlingImage: DockerImage;
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
            objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
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
        const tacWebsite = new Website(this, 'TermsNConditions', {
            contentPath: './website-terms-and-conditions/',
            pathPattern: '/terms-and-conditions.html',
            logsBucket: logsBucket,
            cdnDistribution: cdn.distribution,
        });
        this.tacSourceBucket = tacWebsite.sourceBucket;

        // Terms And Conditions cloudfront Distribution
        const tacCdn = new Cdn(this, 'tacCdn', {
            defaultOrigin: tacWebsite.origin,
            logsBucket: logsBucket,
        });
        this.tacCloudfrontDistribution = tacCdn.distribution;

        // Lambda
        // Common Config
        const lambda_architecture = awsLambda.Architecture.ARM_64;
        const lambda_runtime = awsLambda.Runtime.PYTHON_3_9;
        const lambda_bundling_image = DockerImage.fromRegistry(
            'public.ecr.aws/sam/build-python3.9:latest-arm64'
        );

        // Layers
        // TODO: helperFunctionsLayer can be deleted when the infrastack has changed to usinging the ssm parameter with helperFunctionsLayerV2
        const helperFunctionsLayer = new lambdaPython.PythonLayerVersion(this, 'helper_functions', {
            entry: 'lib/lambdas/helper_functions_layer/http_response/',
            compatibleArchitectures: [lambda_architecture],
            compatibleRuntimes: [lambda_runtime],
            bundling: { image: lambda_bundling_image },
        });

        // Powertools layer
        // TODO: delete after dependecies in the infrastack has been switched over to using ssm
        const powertoolsLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(
            this,
            'lambda_powertools',
            `arn:aws:lambda:${stack.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:11`
        );

        const lambdaLayers = this.lambdaLayers(
            stack,
            lambda_architecture,
            lambda_runtime,
            lambda_bundling_image
        );

        this.lambdaConfig = {
            architecture: lambda_architecture,
            runtime: lambda_runtime,
            bundlingImage: lambda_bundling_image,
        };

        this.exportValue(helperFunctionsLayer.layerVersionArn); // TODO: delete after dependecies has been removed in the infra stack.

        // Event Bus
        this.eventbridge = new Eventbridge(this, 'eventbridge');

        // Cognito Resources
        this.idp = new Idp(this, 'idp', {
            distribution: cdn.distribution,
            defaultAdminEmail: props.email,
            lambdaConfig: {
                ...this.lambdaConfig,
                layersConfig: { ...lambdaLayers },
            },
            eventbus: this.eventbridge.eventbus,
        });
    }

    lambdaLayers = (
        stack: cdk.Stack,
        lambda_architecture: awsLambda.Architecture,
        lambda_runtime: awsLambda.Runtime,
        lambda_bundling_image: DockerImage
    ) => {
        // helper functions layer
        const helperFunctionsLambdaLayer = new lambdaPython.PythonLayerVersion(
            this,
            'helperFunctionsLambdaLayer',
            {
                entry: 'lib/lambda_layers/helper_functions/',
                compatibleArchitectures: [lambda_architecture],
                compatibleRuntimes: [lambda_runtime],
                bundling: { image: lambda_bundling_image },
            }
        );

        new ssm.StringParameter(this, 'helperFunctionsLayerArn', {
            stringValue: helperFunctionsLambdaLayer.layerVersionArn,
            parameterName: `/${this.stackName}/helperFunctionsLambdaLayerArn`,
        });

        // Powertools layer
        const powertoolsLambdaLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(
            this,
            'lambdaPowertoolsLambdaLayer',
            `arn:aws:lambda:${stack.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:11`
        );

        new ssm.StringParameter(this, 'powertoolsLayerArn', {
            stringValue: powertoolsLambdaLayer.layerVersionArn,
            parameterName: `/${this.stackName}/powertoolsLambdaLayerArn`,
        });

        // Appsync helpers layer
        const appsyncHelpersLambdaLayer = new lambdaPython.PythonLayerVersion(
            this,
            'appsyncHelpersLambdaLayer',
            {
                entry: 'lib/lambda_layers/appsync_helpers/',
                compatibleArchitectures: [lambda_architecture],
                compatibleRuntimes: [lambda_runtime],
                bundling: { image: lambda_bundling_image },
            }
        );

        new ssm.StringParameter(this, 'appsyncHelperLambdaLayerArn', {
            stringValue: appsyncHelpersLambdaLayer.layerVersionArn,
            parameterName: `/${this.stackName}/appsyncHelpersLambdaLayerArn`,
        });

        return {
            helperFunctionsLayer: helperFunctionsLambdaLayer,
            powerToolsLayer: powertoolsLambdaLayer,
            powerToolsLogLevel: 'INFO',
        };
    };
}
