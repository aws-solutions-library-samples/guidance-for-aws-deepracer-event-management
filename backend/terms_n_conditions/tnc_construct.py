import decimal

# from constructs import Construct
from aws_cdk import (
    Stack,
    RemovalPolicy,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfront_origins,
    aws_s3 as s3,
    aws_s3_deployment as s3_deployment,
)

from constructs import Construct


class TermsAndConditions(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        logs_bucket: s3.IBucket,
        distribution: cloudfront.Distribution,
        **kwargs
    ):
        super().__init__(scope, id, **kwargs)

        stack = Stack.of(self)

        tnc_bucket = s3.Bucket(
            self,
            "TncBucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=logs_bucket,
            server_access_logs_prefix="access-logs/tnc_bucket/",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
        )

        s3_deployment.BucketDeployment(
            self,
            "TncDeploy",
            sources=[
                s3_deployment.Source.asset(
                    path="./backend/terms_n_conditions/webpage/",
                ),
            ],
            destination_bucket=tnc_bucket,
            # destination_key_prefix='tnc/{}:00000000-0000-0000-0000-000000000000/default/models/'.format(stack.region),
            retain_on_delete=False,
        )

        origin_access_identity = cloudfront.OriginAccessIdentity(
            self, "TncOAI", comment=stack.stack_name
        )

        tnc_origin = cloudfront_origins.S3Origin(
            bucket=tnc_bucket, origin_access_identity=origin_access_identity
        )

        distribution.add_behavior(
            path_pattern="terms_and_conditions.html", origin=tnc_origin
        )
