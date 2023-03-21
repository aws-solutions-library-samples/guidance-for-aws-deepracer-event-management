import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';
import { Cdn } from './cdn';
import { Website } from './website';

export interface StreamingOverlayProps {
    logsBucket: IBucket;
}

export class StreamingOverlay extends Construct {
    public readonly distribution: Distribution;
    public readonly websiteBucket: Bucket;

    constructor(scope: Construct, id: string, props: StreamingOverlayProps) {
        super(scope, id);

        // WEBSITE
        const websiteHosting = new Website(this, 'websiteHosting', {
            logsBucket: props.logsBucket,
        });

        const cdn = new Cdn(this, 'cdn', {
            defaultOrigin: websiteHosting.origin,
            logsBucket: props.logsBucket,
        });
        this.distribution = cdn.distribution;
        this.websiteBucket = websiteHosting.sourceBucket;
    }
}
