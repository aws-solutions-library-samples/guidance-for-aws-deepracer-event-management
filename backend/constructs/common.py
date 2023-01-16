from aws_cdk import DockerImage, Duration, NestedStack, RemovalPolicy, Stack
from aws_cdk import aws_apigateway as apig
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as awslambda
from aws_cdk import aws_lambda_python_alpha as lambda_python
from aws_cdk import aws_logs as logs
from aws_cdk import aws_s3 as s3
from constructs import Construct

from backend.constructs.idp import Idp
from backend.constructs.website import Website


class RestApi(Construct):
    @property
    def rest_api(self) -> apig.IRestApi:
        return self._rest_api

    @property
    def admin_api_node(self) -> apig.IResource:
        return self._api_admin

    def __init__(self, scope, id: str, distribution_domain_name: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # setup for pseudo parameters
        stack = Stack.of(self)

        apig_log_group = logs.LogGroup(
            self, "apig_log_group", retention=logs.RetentionDays.ONE_MONTH
        )

        self._rest_api = apig.RestApi(
            self,
            "api",
            rest_api_name=stack.stack_name,
            deploy_options=apig.StageOptions(
                throttling_rate_limit=10,
                throttling_burst_limit=20,
                tracing_enabled=True,
                access_log_destination=apig.LogGroupLogDestination(apig_log_group),
                access_log_format=apig.AccessLogFormat.json_with_standard_fields(
                    caller=True,
                    http_method=True,
                    ip=True,
                    protocol=True,
                    request_time=True,
                    resource_path=True,
                    response_length=True,
                    status=True,
                    user=True,
                ),
                logging_level=apig.MethodLoggingLevel.ERROR,
            ),
            default_cors_preflight_options=apig.CorsOptions(
                allow_origins=[
                    "http://localhost:3000",
                    "https://" + distribution_domain_name,
                ],
                allow_credentials=True,
            ),
        )

        # API Validation models
        self._rest_api.add_model(
            "hostanameModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "hostname": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                },
            ),
        )

        self._rest_api.add_model(
            "UsernameModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "username": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                },
            ),
        )

        # Base API structure
        # /admin
        self._api_admin = self._rest_api.root.add_resource("admin")

        self._body_validator = apig.RequestValidator(
            self,
            "BodyValidator",
            rest_api=self._rest_api,
            validate_request_body=True,
        )

        self._instanceid_commandid_model = self._rest_api.add_model(
            "IanstanceIdCommandIdModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "InstanceId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                    "CommandId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                },
            ),
        )

        # # API Validation models
        # base_stack.rest_api.add_model(
        #     "hostanameModel",
        #     content_type="application/json",
        #     schema=apig.JsonSchema(
        #         schema=apig.JsonSchemaVersion.DRAFT4,
        #         type=apig.JsonSchemaType.OBJECT,
        #         properties={
        #             "hostname": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
        #         },
        #     ),
        # )

        # base_stack.rest_api.add_model(
        #     "UsernameModel",
        #     content_type="application/json",
        #     schema=apig.JsonSchema(
        #         schema=apig.JsonSchemaVersion.DRAFT4,
        #         type=apig.JsonSchemaType.OBJECT,
        #         properties={
        #             "username": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
        #         },
        #     ),
        # )

        # instanceid_commandid_model = base_stack.rest_api.add_model(
        #     "IanstanceIdCommandIdModel",
        #     content_type="application/json",
        #     schema=apig.JsonSchema(
        #         schema=apig.JsonSchemaVersion.DRAFT4,
        #         type=apig.JsonSchemaType.OBJECT,
        #         properties={
        #             "InstanceId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
        #             "CommandId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
        #         },
        #     ),
        # )

        # instanceid_model = base_stack.rest_api.add_model(
        #     "InstanceIdModel",
        #     content_type="application/json",
        #     schema=apig.JsonSchema(
        #         schema=apig.JsonSchemaVersion.DRAFT4,
        #         type=apig.JsonSchemaType.OBJECT,
        #         properties={
        #             "InstanceId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
        #         },
        #     ),
        # )


class BaseStack(Construct):
    @property
    def idp(self) -> Idp:
        return self._idp

    @property
    def cloudfront_distribution(self) -> cloudfront.IDistribution:
        return self._distribution

    @property
    def logs_bucket(self) -> s3.IBucket:
        return self._logs_bucket

    @property
    def rest_api(self) -> RestApi:
        return self._rest_api

    @property
    def drem_website(self) -> Website:
        return self._drem_website

    def __init__(self, scope, id: str, email: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # setup for pseudo parameters
        stack = Stack.of(self)

        # Logs Bucket
        self._logs_bucket = s3.Bucket(
            self,
            "logs_bucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_prefix="access-logs/logs_bucket/",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[
                s3.LifecycleRule(expiration=Duration.days(30)),
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1)
                ),
            ],
        )

        self._logs_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[
                    self._logs_bucket.bucket_arn,
                    self._logs_bucket.bucket_arn + "/*",
                ],
                conditions={"NumericLessThan": {"s3:TlsVersion": "1.2"}},
            )
        )

        # Drem website infra need to be created here since a disribution
        # need a default_behaviour to be created
        self._drem_website = Website(self, "DremWebsite", logs_bucket=self._logs_bucket)

        # Distribution
        self._distribution = cloudfront.Distribution(
            self,
            "Distribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=self._drem_website.origin,
                response_headers_policy=cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS,  # noqa: E501
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,  # noqa: E501
            ),
            http_version=cloudfront.HttpVersion.HTTP2_AND_3,
            default_root_object="index.html",
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
            log_bucket=self._logs_bucket,
            log_file_prefix="access-logs/cf_distribution/",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
                # cloudfront.ErrorResponse(
                #     http_status=404,
                #     response_http_status=200,
                #     response_page_path="/errors/404.html"
                # )
            ],
        )
        # Lambda
        # Common Config
        self._lambda_architecture = awslambda.Architecture.ARM_64
        self._lambda_runtime = awslambda.Runtime.PYTHON_3_9
        self._lambda_bundling_image = DockerImage.from_registry(
            "public.ecr.aws/sam/build-python3.9:latest-arm64"
        )

        # Layers
        self._helper_functions_layer = lambda_python.PythonLayerVersion(
            self,
            "helper_functions_v2",
            entry="backend/lambdas/helper_functions_layer/http_response/",
            compatible_architectures=[self._lambda_architecture],
            compatible_runtimes=[self._lambda_runtime],
            bundling=lambda_python.BundlingOptions(image=self._lambda_bundling_image),
        )

        # Powertools layer
        self._powertools_layer = lambda_python.PythonLayerVersion.from_layer_version_arn(  # noqa: E501
            self,
            "lambda_powertools",
            layer_version_arn="arn:aws:lambda:{}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:11".format(  # noqa: E501
                stack.region
            ),
        )
        self._powertools_log_level = "INFO"

        # Cognito Resources
        self._idp = Idp(
            self, "idp", distribution=self._distribution, default_admin_email=email
        )

        # API Gateway
        self._rest_api = RestApi(
            self,
            "RestApi",
            distribution_domain_name=self._distribution.distribution_domain_name,
        )
