from aws_cdk import DockerImage, Duration, RemovalPolicy
from aws_cdk import aws_apigateway as apig
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as awslambda
from aws_cdk import aws_lambda_python_alpha as lambda_python
from aws_cdk import aws_s3 as s3
from constructs import Construct


class LabelPrinter(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        api_cars_upload: apig.Resource,
        api_instanceid_commandid_model: apig.Model,
        api_body_validator: apig.RequestValidator,
        logs_bucket: s3.Bucket,
        helper_functions_layer: lambda_python.PythonLayerVersion,
        powertools_layer: lambda_python.PythonLayerVersion,
        powertools_log_level: str,
        lambda_architecture: awslambda.Architecture,
        lambda_runtime: awslambda.Runtime,
        lambda_bundling_image: DockerImage,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        # Labels S3 bucket
        labels_bucket = s3.Bucket(
            self,
            "labels_bucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=logs_bucket,
            server_access_logs_prefix="access-logs/labels_bucket/",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
        )

        labels_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[labels_bucket.bucket_arn, labels_bucket.bucket_arn + "/*"],
                conditions={"NumericLessThan": {"s3:TlsVersion": "1.2"}},
            )
        )

        # Layers
        print_functions_layer = lambda_python.PythonLayerVersion(
            self,
            "print_functions",
            entry="backend/lambdas/print_functions_layer/",
            compatible_architectures=[lambda_architecture],
            compatible_runtimes=[lambda_runtime],
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
        )

        # Functions
        print_label_function = lambda_python.PythonFunction(
            self,
            "print_label_function",
            entry="backend/lambdas/print_label_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=256,
            architecture=lambda_architecture,
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, print_functions_layer, powertools_layer],
            environment={
                "LABELS_S3_BUCKET": labels_bucket.bucket_name,
                "URL_EXPIRY": "3600",
                "POWERTOOLS_SERVICE_NAME": "print_label",
                "LOG_LEVEL": powertools_log_level,
            },
        )

        # Bucket permissions
        labels_bucket.grant_read_write(print_label_function, "*")

        api_cars_label = api_cars_upload.add_resource("label")
        api_cars_label.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=print_label_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={"application/json": api_instanceid_commandid_model},
            request_validator=api_body_validator,
        )
