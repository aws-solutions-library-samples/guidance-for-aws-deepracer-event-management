from aws_cdk import RemovalPolicy, Stack
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as cloudfront_origins
from aws_cdk import aws_iam as iam
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_deployment as s3_deployment
from constructs import Construct


class Website(Construct):
    @property
    def origin(self) -> cloudfront.IOrigin:
        return self._s3_origin

    @property
    def bucket(self) -> s3.IBucket:
        return self._source_bucket

    def __init__(
        self,
        scope: Construct,
        id: str,
        logs_bucket: s3.IBucket,
        content_path: str = None,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        stack = Stack.of(self)

        # S3
        self._source_bucket = s3.Bucket(
            self,
            "Bucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=logs_bucket,
            server_access_logs_prefix="access-logs/source_bucket/",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
        )

        self._source_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[
                    self._source_bucket.bucket_arn,
                    self._source_bucket.bucket_arn + "/*",
                ],
                conditions={"NumericLessThan": {"s3:TlsVersion": "1.2"}},
            )
        )

        # CloudFront and OAI
        # L2 Experimental variant CF + OAI
        _origin_access_identity = cloudfront.OriginAccessIdentity(
            self, "OAI", comment=stack.stack_name
        )

        self._s3_origin = cloudfront_origins.S3Origin(
            bucket=self._source_bucket, origin_access_identity=_origin_access_identity
        )

        # Conditional upload of content to the website bucket
        if content_path:
            s3_deployment.BucketDeployment(
                self,
                "deploy",
                sources=[
                    s3_deployment.Source.asset(
                        path=content_path,  # "./backend/constructs/terms_n_conditions/webpage/",
                    ),
                ],
                destination_bucket=self._source_bucket,
                # destination_key_prefix='tnc/{}:00000000-0000-0000-0000-000000000000/default/models/'.format(stack.region),
                retain_on_delete=False,
            )
