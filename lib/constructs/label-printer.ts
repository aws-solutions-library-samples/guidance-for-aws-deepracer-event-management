import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IBucket } from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';

export interface LabelPrinterProps {
    adminGroupRole: IRole;
    logsbucket: IBucket;
    restApi: {
        api: apig.RestApi;
        apiAdminResource: apig.Resource;
        apiCarsUploadResource: apig.Resource;
        bodyValidator: apig.RequestValidator;
        instanceidCommandIdModel: apig.Model;
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
}

export class LabelPrinter extends Construct {
    constructor(scope: Construct, id: string, props: LabelPrinterProps) {
        super(scope, id);

        // Labels S3 bucket
        const labels_bucket = new s3.Bucket(this, 'labelsBucket', {
            encryption: s3.BucketEncryption.S3_MANAGED,
            serverAccessLogsBucket: props.logsbucket,
            serverAccessLogsPrefix: 'access-logs/labels_bucket/',
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        labels_bucket.policy!.document.addStatements(
            new iam.PolicyStatement({
                sid: 'AllowSSLRequestsOnly',
                effect: iam.Effect.DENY,
                principals: [new iam.AnyPrincipal()],
                actions: ['s3:*'],
                resources: [labels_bucket.bucketArn, labels_bucket.bucketArn + '/*'],
                conditions: { NumericLessThan: { 's3:TlsVersion': '1.2' } },
            })
        );

        // Layers
        const print_functions_layer = new lambdaPython.PythonLayerVersion(this, 'print_functions', {
            entry: 'lib/lambdas/print_functions_layer/',
            compatibleArchitectures: [props.lambdaConfig.architecture],
            compatibleRuntimes: [props.lambdaConfig.runtime],
            bundling: {
                image: props.lambdaConfig.bundlingImage,
            },
        });

        // Functions
        const print_label_function = new lambdaPython.PythonFunction(this, 'print_label_function', {
            entry: 'lib/lambdas/print_label_function/',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 256,
            architecture: props.lambdaConfig.architecture,
            bundling: {
                image: props.lambdaConfig.bundlingImage,
            },
            layers: [
                print_functions_layer,
                props.lambdaConfig.layersConfig.helperFunctionsLayer,
                props.lambdaConfig.layersConfig.powerToolsLayer,
            ],
            environment: {
                LABELS_S3_BUCKET: labels_bucket.bucketName,
                URL_EXPIRY: '3600',
                POWERTOOLS_SERVICE_NAME: 'print_label',
                LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
            },
        });

        // Bucket permissions
        labels_bucket.grantReadWrite(print_label_function, '*');

        const api_cars_label = props.restApi.apiCarsUploadResource.addResource('label');
        api_cars_label.addMethod('GET', new apig.LambdaIntegration(print_label_function), {
            authorizationType: apig.AuthorizationType.IAM,
            requestModels: { 'application/json': props.restApi.instanceidCommandIdModel },
            requestValidator: props.restApi.bodyValidator,
        });
    }
}
