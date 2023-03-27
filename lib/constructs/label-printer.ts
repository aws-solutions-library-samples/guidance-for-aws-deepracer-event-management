import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { aws_dynamodb, DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IBucket } from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';
import { CodeFirstSchema, GraphqlType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';
import { FunctionUrl } from 'aws-cdk-lib/aws-lambda';

export interface LabelPrinterProps {
    logsbucket: IBucket;
    appsyncApi: {
        schema: CodeFirstSchema;
        api: appsync.IGraphqlApi;
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
    carStatusDataHandlerLambda: lambdaPython.PythonFunction;
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

        // remove old labels after 10 days
        labels_bucket.addLifecycleRule({
            enabled: true,
            expiration: Duration.days(10),
        });

        // Layers
        const printFunctionsLambdaLayer = new lambdaPython.PythonLayerVersion(
            this,
            'print_functions',
            {
                entry: 'lib/lambdas/print_functions_layer/',
                compatibleArchitectures: [props.lambdaConfig.architecture],
                compatibleRuntimes: [props.lambdaConfig.runtime],
                bundling: {
                    image: props.lambdaConfig.bundlingImage,
                },
            }
        );

        // Functions
        const printLabelLambdaFunction = new lambdaPython.PythonFunction(
            this,
            'print_label_function',
            {
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
                    printFunctionsLambdaLayer,
                    props.lambdaConfig.layersConfig.helperFunctionsLayer,
                    props.lambdaConfig.layersConfig.powerToolsLayer,
                ],
                environment: {
                    LABELS_S3_BUCKET: labels_bucket.bucketName,
                    URL_EXPIRY: '36000',
                    POWERTOOLS_SERVICE_NAME: 'print_label',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                    CAR_STATUS_DATA_HANDLER_LAMBDA_NAME:
                        props.carStatusDataHandlerLambda.functionName,
                },
            }
        );

        props.carStatusDataHandlerLambda.grantInvoke(printLabelLambdaFunction);

        // Bucket permissions
        labels_bucket.grantReadWrite(printLabelLambdaFunction, '*');

        // AppSync Api
        const printableLabelDataSource = props.appsyncApi.api.addLambdaDataSource(
            'printableLabelDataSource',
            printLabelLambdaFunction
        );

        const printableLabelObjectType = new ObjectType('carPrintableLabel', {
            definition: {
                printableLabel: GraphqlType.awsUrl(),
            },
        });

        props.appsyncApi.schema.addType(printableLabelObjectType);

        // Event Methods
        props.appsyncApi.schema.addQuery(
            'carPrintableLabel',
            new ResolvableField({
                args: {
                    instanceId: GraphqlType.string(),
                },
                dataSource: printableLabelDataSource,
                // returnType: printableLabelObjectType.attribute(),
                returnType: GraphqlType.string(),
            })
        );
    }
}
