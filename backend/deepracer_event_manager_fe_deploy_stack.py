from aws_cdk import (
    Stack, 
    BundlingOptions,
    DockerImage,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_s3_deployment as s3_deployment
)

from constructs import Construct

class CdkDeepRacerEventManagerFEDeployStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, source_bucket: s3.Bucket, distribution: cloudfront.CloudFrontWebDistribution, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        ## Deploy Website
        deployment = s3_deployment.BucketDeployment(self, 'DeployWebsite', 
            sources= [
                s3_deployment.Source.asset(
                    path='./website',
                    bundling=BundlingOptions(
                        image=DockerImage.from_registry("public.ecr.aws/sam/build-nodejs14.x"),
                        command=[
                            'bash', '-c', ' && '.join([
                                'npm install --cache /tmp/empty-cache',
                                'npm run build',
                                'cp -r build/* /asset-output/',
                            ]),
                        ]
                    )
                ),
            ],
            destination_bucket= source_bucket,
            distribution= distribution,
            distribution_paths= ['/*'], # paths to invalidate in CF cache
        )



