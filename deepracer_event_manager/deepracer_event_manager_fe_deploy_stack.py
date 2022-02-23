from aws_cdk import (
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_s3_deployment as s3_deployment,
    core as cdk
)

class CdkDeepRacerEventManagerFEDeployStack(cdk.Stack):

    def __init__(self, scope: cdk.Construct, construct_id: str, source_bucket: s3.Bucket, distribution: cloudfront.CloudFrontWebDistribution, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        ## Deploy Website
        deployment = s3_deployment.BucketDeployment(self, 'DeployWebsite', 
            sources= [
                s3_deployment.Source.asset(
                    path='./website',
                    bundling=cdk.BundlingOptions(
                        image=cdk.DockerImage.from_registry("public.ecr.aws/sam/build-nodejs14.x"),
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



