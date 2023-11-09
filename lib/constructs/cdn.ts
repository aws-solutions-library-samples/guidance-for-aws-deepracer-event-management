import { Stack } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { IOrigin } from 'aws-cdk-lib/aws-cloudfront';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface CdnProps {
  logsBucket: IBucket;
  defaultOrigin: IOrigin;
}

export class Cdn extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CdnProps) {
    super(scope, id);

    const stack = Stack.of(this);

    //  cloudfront Distribution
    const cloudfrontDistribution = new cloudfront.Distribution(this, 'distribution', {
      defaultBehavior: {
        origin: props.defaultOrigin,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      logBucket: props.logsBucket,
      logFilePrefix: 'access-logs/cf_distribution/',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/errors/404.html' },
      ],
    });

    this.distribution = cloudfrontDistribution;

    NagSuppressions.addResourceSuppressionsByPath(stack, `${scope.node.path}/${id}/distribution/Resource`, [
      {
        id: 'AwsSolutions-CFR4',
        reason:
          'The CloudFront distribution allows for SSLv3 or TLSv1 for HTTPS viewer connections as they can not be disabled without enabling custom certificates.',
      },
    ]);
  }
}
