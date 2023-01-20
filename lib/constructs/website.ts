import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3_deployment from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface WebsiteProps {
    logsBucket: s3.IBucket;
    //cdnDistribution?: cloudfront.Distribution
    contentPath?: string;
    pathPattern?: string;
}

export class Website extends Construct {
    public readonly origin: cloudfront.IOrigin;
    public readonly sourceBucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: WebsiteProps) {
        super(scope, id);

        const sourceBucket = new s3.Bucket(this, 'bucket', {
            encryption: s3.BucketEncryption.S3_MANAGED,
            serverAccessLogsBucket: props.logsBucket,
            serverAccessLogsPrefix: `access-logs/${id}-bucket/`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            lifecycleRules: [
                { expiration: Duration.days(30) },
                { abortIncompleteMultipartUploadAfter: Duration.days(1) },
            ],
        });

        this.sourceBucket = sourceBucket;

        sourceBucket.policy?.document.addStatements(
            new iam.PolicyStatement({
                sid: 'AllowSSLRequestsOnly',
                effect: iam.Effect.DENY,
                principals: [new iam.AnyPrincipal()],
                actions: ['s3:*'],
                resources: [sourceBucket.bucketArn, sourceBucket.bucketArn + '/*'],
                conditions: { NumericLessThan: { 's3:TlsVersion': '1.2' } },
            })
        );

        // CloudFront and OAI
        // L2 Experimental variant CF + OAI
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
            comment: `Cloudfront to ${id}`,
        });

        const origin = new cloudfront_origins.S3Origin(sourceBucket, {
            originAccessIdentity: originAccessIdentity,
        });

        this.origin = origin;

        // TODO NOT WORLKING - CIRCULAR DEPENDENCY
        // if (props.pathPattern) {
        //   props.cdnDistribution!.addBehavior(props.pathPattern, origin)
        // }

        if (props.contentPath) {
            new s3_deployment.BucketDeployment(this, 'deploy', {
                sources: [s3_deployment.Source.asset(props.contentPath)],
                destinationBucket: sourceBucket,
                retainOnDelete: false,
            });
        }
    }
}
