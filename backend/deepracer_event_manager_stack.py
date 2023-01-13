from aws_cdk import CfnOutput, DockerImage, Duration, RemovalPolicy, Stack
from aws_cdk import aws_apigateway as apig
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as cloudfront_origins
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as awslambda
from aws_cdk import aws_lambda_destinations as lambda_destinations
from aws_cdk import aws_lambda_python_alpha as lambda_python
from aws_cdk import aws_logs as logs
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_deployment as s3_deployment
from cdk_nag import NagSuppressions
from cdk_serverless_clamscan import ServerlessClamscan
from constructs import Construct

from backend.cars_manager import CarsManager
from backend.cwrum_construct import CwRumAppMonitor
from backend.events_manager import EventsManager
from backend.fleets_manager import FleetsManager
from backend.graphql_api.api import API as graphqlApi
from backend.label_printer import LabelPrinter
from backend.leaderboard.leaderboard_construct import Leaderboard
from backend.models_manager import ModelsManager

# from backend.systems_manager import SystemsManager
from backend.terms_n_conditions.tnc_construct import TermsAndConditions
from backend.users_n_groups.idp import Idp


class CdkDeepRacerEventManagerStack(Stack):
    def __init__(
        self, scope: Construct, construct_id: str, email: str, **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # setup for pseudo parameters
        stack = Stack.of(self)

        # Logs Bucket
        logs_bucket = s3.Bucket(
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

        logs_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[logs_bucket.bucket_arn, logs_bucket.bucket_arn + "/*"],
                conditions={"NumericLessThan": {"s3:TlsVersion": "1.2"}},
            )
        )

        # Models S3 bucket
        models_bucket = s3.Bucket(
            self,
            "models_bucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=logs_bucket,
            server_access_logs_prefix="access-logs/models_bucket/",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=Duration.days(15), tag_filters={"lifecycle": "true"}
                ),
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1)
                ),
            ],
        )

        models_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[models_bucket.bucket_arn, models_bucket.bucket_arn + "/*"],
                conditions={"NumericLessThan": {"s3:TlsVersion": "1.2"}},
            )
        )

        infected_bucket = s3.Bucket(
            self,
            "infected_bucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=logs_bucket,
            server_access_logs_prefix="access-logs/infected_bucket/",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[
                s3.LifecycleRule(expiration=Duration.days(1)),
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1)
                ),
            ],
        )

        infected_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[
                    infected_bucket.bucket_arn,
                    infected_bucket.bucket_arn + "/*",
                ],
                conditions={"NumericLessThan": {"s3:TlsVersion": "1.2"}},
            )
        )
        # Lambda
        # Common Config
        lambda_architecture = awslambda.Architecture.ARM_64
        lambda_runtime = awslambda.Runtime.PYTHON_3_9
        lambda_bundling_image = DockerImage.from_registry(
            "public.ecr.aws/sam/build-python3.9:latest-arm64"
        )

        # Layers
        helper_functions_layer = lambda_python.PythonLayerVersion(
            self,
            "helper_functions_v2",
            entry="backend/lambdas/helper_functions_layer/http_response/",
            compatible_architectures=[lambda_architecture],
            compatible_runtimes=[lambda_runtime],
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
        )

        # Powertools layer
        powertools_layer = lambda_python.PythonLayerVersion.from_layer_version_arn(
            self,
            "lambda_powertools",
            layer_version_arn="arn:aws:lambda:{}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:11".format(  # noqa: E501
                stack.region
            ),
        )
        powertools_log_level = "INFO"

        # Models table, used by delete_infected_files_function and also models_manager
        models_table = dynamodb.Table(
            self,
            "ModelsTable",
            partition_key=dynamodb.Attribute(
                name="modelId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption=dynamodb.TableEncryption.AWS_MANAGED,
            stream=dynamodb.StreamViewType.NEW_IMAGE,
            removal_policy=RemovalPolicy.DESTROY,
        )
        models_table.add_global_secondary_index(
            index_name="racerNameIndex",
            partition_key=dynamodb.Attribute(
                name="racerName", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="modelId", type=dynamodb.AttributeType.STRING
            ),
            non_key_attributes=["modelKey", "modelFilename"],
            projection_type=dynamodb.ProjectionType.INCLUDE,
        )

        delete_infected_files_function = lambda_python.PythonFunction(
            self,
            "delete_infected_files_function",
            entry="backend/lambdas/delete_infected_files_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=256,
            architecture=lambda_architecture,
            environment={
                "DDB_TABLE": models_table.table_name,
                "MODELS_S3_BUCKET": models_bucket.bucket_name,
                "INFECTED_S3_BUCKET": infected_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "delete_infected_files",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )

        # Bucket and DynamoDB permissions
        models_bucket.grant_read_write(delete_infected_files_function, "*")
        infected_bucket.grant_read_write(delete_infected_files_function, "*")
        models_table.grant_read_write_data(delete_infected_files_function)

        # Add clam av scan to S3 uploads bucket
        bucketList = [models_bucket]
        ServerlessClamscan(
            self,
            "rClamScan",
            buckets=bucketList,
            on_result=lambda_destinations.LambdaDestination(
                delete_infected_files_function
            ),
            on_error=lambda_destinations.LambdaDestination(
                delete_infected_files_function
            ),
        )

        # Models Function
        models_function = lambda_python.PythonFunction(
            self,
            "get_models_function",
            entry="backend/lambdas/get_models_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "bucket": models_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "get_models",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )

        # Permissions for s3 bucket read
        models_bucket.grant_read(models_function, "private/*")

        # Quarantine Models Function
        quarantined_models_function = lambda_python.PythonFunction(
            self,
            "get_quarantined_models_function",
            entry="backend/lambdas/get_quarantined_models_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "infected_bucket": infected_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "get_quarantined_models",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer],
        )

        # permissions for s3 bucket read
        infected_bucket.grant_read(quarantined_models_function, "private/*")

        # upload_model_to_car_function
        upload_model_to_car_function = lambda_python.PythonFunction(
            self,
            "upload_model_to_car_function",
            entry="backend/lambdas/upload_model_to_car_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "bucket": models_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "upload_model_to_car",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        upload_model_to_car_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:GetCommandInvocation",
                    "ssm:SendCommand",
                ],
                resources=["*"],
            )
        )

        # upload_model_to_car_function
        upload_model_to_car_status_function = lambda_python.PythonFunction(
            self,
            "upload_model_to_car_status_function",
            entry="backend/lambdas/upload_model_to_car_status_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "POWERTOOLS_SERVICE_NAME": "upload_model_to_car_status",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        upload_model_to_car_status_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:GetCommandInvocation",
                ],
                resources=["*"],
            )
        )
        # permissions for s3 bucket read
        models_bucket.grant_read(upload_model_to_car_function, "private/*")

        # Website

        # S3
        source_bucket = s3.Bucket(
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
        self.source_bucket = source_bucket

        source_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[source_bucket.bucket_arn, source_bucket.bucket_arn + "/*"],
                conditions={"NumericLessThan": {"s3:TlsVersion": "1.2"}},
            )
        )

        # CloudFront and OAI
        # L2 Experimental variant CF + OAI
        origin_access_identity = cloudfront.OriginAccessIdentity(
            self, "OAI", comment=stack.stack_name
        )

        distribution = cloudfront.Distribution(
            self,
            "Distribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=cloudfront_origins.S3Origin(
                    bucket=source_bucket, origin_access_identity=origin_access_identity
                ),
                response_headers_policy=cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS,  # noqa: E501
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,  # noqa: E501
            ),
            http_version=cloudfront.HttpVersion.HTTP2_AND_3,
            default_root_object="index.html",
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
            log_bucket=logs_bucket,
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

        NagSuppressions.add_resource_suppressions(
            distribution,
            suppressions=[
                {
                    "id": "AwsSolutions-CFR1",
                    "reason": "Cloudfront geo restriction not needed for DREM use case",
                },
                {
                    "id": "AwsSolutions-CFR2",
                    "reason": "DREM use case does not warrant for usage of AWS WAF",
                },
            ],
        )

        self.distribution = distribution

        TermsAndConditions(
            self, "TnC", logs_bucket=logs_bucket, distribution=distribution
        )

        models_bucket.add_cors_rule(
            allowed_headers=["*"],
            allowed_methods=[
                s3.HttpMethods.PUT,
                s3.HttpMethods.POST,
                s3.HttpMethods.GET,
                s3.HttpMethods.HEAD,
                s3.HttpMethods.DELETE,
            ],
            allowed_origins=[
                "*",
                # "http://localhost:3000",
                # "https://" + distribution.distribution_domain_name
            ],
            exposed_headers=[
                "x-amz-server-side-encryption",
                "x-amz-request-id",
                "x-amz-id-2",
                "ETag",
            ],
            max_age=3000,
        )

        # # Cognito User Pool
        idp = Idp(self, "idp", distribution=distribution, default_admin_email=email)

        models_bucket.grant_read(idp.admin_user_role, "*")
        models_bucket.grant_read(idp.operator_user_role, "*")

        # read/write own bucket only
        idp.admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:ListBucket",
                ],
                resources=[models_bucket.bucket_arn],
                conditions={
                    "StringLike": {
                        "s3:prefix": [
                            "private/${cognito-identity.amazonaws.com:sub}/*"
                        ],
                    },
                },
            )
        )

        idp.admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:PutObjectTagging",
                ],
                resources=[
                    models_bucket.bucket_arn
                    + "/private/${cognito-identity.amazonaws.com:sub}",
                    models_bucket.bucket_arn
                    + "/private/${cognito-identity.amazonaws.com:sub}/*",
                ],
            )
        )

        # read/write own bucket only
        idp.operator_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:ListBucket",
                ],
                resources=[models_bucket.bucket_arn],
                conditions={
                    "StringLike": {
                        "s3:prefix": [
                            "private/${cognito-identity.amazonaws.com:sub}/*"
                        ],
                    },
                },
            )
        )

        idp.operator_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:PutObjectTagging",
                ],
                resources=[
                    models_bucket.bucket_arn
                    + "/private/${cognito-identity.amazonaws.com:sub}",
                    models_bucket.bucket_arn
                    + "/private/${cognito-identity.amazonaws.com:sub}/*",
                ],
            )
        )

        # Lambda
        # List users Function
        get_users_function = lambda_python.PythonFunction(
            self,
            "get_users_function",
            entry="backend/lambdas/get_users_function/",
            description="List the users in cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "user_pool_id": idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "get_users",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        get_users_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:ListUsers",
                ],
                resources=[idp.user_pool.user_pool_arn],
            )
        )

        # GET groups users Function
        get_groups_group_function = lambda_python.PythonFunction(
            self,
            "get_groups_group_function",
            entry="backend/lambdas/get_groups_group_function/",
            description="Get the group details from cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "user_pool_id": idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "get_groups_group",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        get_groups_group_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:ListUsersInGroup",
                ],
                resources=[idp.user_pool.user_pool_arn],
            )
        )

        # Post groups group user Function
        post_groups_group_user_function = lambda_python.PythonFunction(
            self,
            "post_groups_group_user_function",
            entry="backend/lambdas/post_groups_group_user_function/",
            description="Add a user to a group in cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "user_pool_id": idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "post_groups_group_user",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        post_groups_group_user_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:AdminAddUserToGroup",
                ],
                resources=[idp.user_pool.user_pool_arn],
            )
        )

        # Delete groups group user Function
        delete_groups_group_user_function = lambda_python.PythonFunction(
            self,
            "delete_groups_group_user_function",
            entry="backend/lambdas/delete_groups_group_user_function/",
            description="Remove a user from a group in cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "user_pool_id": idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "delete_groups_group_user",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        delete_groups_group_user_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:AdminRemoveUserFromGroup",
                ],
                resources=[idp.user_pool.user_pool_arn],
            )
        )

        # Get groups Function
        get_groups_function = lambda_python.PythonFunction(
            self,
            "get_groups_function",
            entry="backend/lambdas/get_groups_function/",
            description="List the groups in cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "user_pool_id": idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "get_groups",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        get_groups_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:ListGroups",
                ],
                resources=[idp.user_pool.user_pool_arn],
            )
        )

        # Put groups group Function
        put_groups_group_function = lambda_python.PythonFunction(
            self,
            "put_groups_group_function",
            entry="backend/lambdas/put_groups_group_function/",
            description="Add a group to cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "user_pool_id": idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "put_groups_group",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        put_groups_group_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:CreateGroup",
                ],
                resources=[idp.user_pool.user_pool_arn],
            )
        )

        # Delete groups group Function
        delete_groups_group_function = lambda_python.PythonFunction(
            self,
            "delete_groups_group_function",
            entry="backend/lambdas/delete_groups_group_function/",
            description="Delete a group from cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "user_pool_id": idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "delete_groups_group",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        delete_groups_group_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:DeleteGroup",
                ],
                resources=[idp.user_pool.user_pool_arn],
            )
        )

        # Appsync API
        appsync_api = graphqlApi(self, "AppsyncApi")
        none_data_source = appsync_api.api.add_none_data_source("none")

        EventsManager(
            self,
            "EventsManager",
            api=appsync_api.api,
            none_data_source=none_data_source,
            user_pool=idp.user_pool,
            powertools_layer=powertools_layer,
            powertools_log_level=powertools_log_level,
            lambda_architecture=lambda_architecture,
            lambda_runtime=lambda_runtime,
            lambda_bundling_image=lambda_bundling_image,
            roles_to_grant_invoke_access=[idp.admin_user_role],
        )

        FleetsManager(
            self,
            "FleetsManager",
            api=appsync_api.api,
            none_data_source=none_data_source,
            user_pool=idp.user_pool,
            powertools_layer=powertools_layer,
            powertools_log_level=powertools_log_level,
            lambda_architecture=lambda_architecture,
            lambda_runtime=lambda_runtime,
            lambda_bundling_image=lambda_bundling_image,
            roles_to_grant_invoke_access=[idp.admin_user_role],
        )

        CarsManager(
            self,
            "CarsManager",
            api=appsync_api.api,
            powertools_layer=powertools_layer,
            powertools_log_level=powertools_log_level,
            lambda_architecture=lambda_architecture,
            lambda_runtime=lambda_runtime,
            lambda_bundling_image=lambda_bundling_image,
            roles_to_grant_invoke_access=[idp.admin_user_role],
        )

        # SystemsManager(self, "SystemsManager")

        ModelsManager(
            self,
            "ModelsManager",
            api=appsync_api.api,
            none_data_source=none_data_source,
            models_bucket=models_bucket,
            models_table=models_table,
            helper_functions_layer=helper_functions_layer,
            powertools_layer=powertools_layer,
            powertools_log_level=powertools_log_level,
            lambda_architecture=lambda_architecture,
            lambda_runtime=lambda_runtime,
            lambda_bundling_image=lambda_bundling_image,
            roles_to_grant_invoke_access=[idp.admin_user_role],
        )

        # API Gateway
        apig_log_group = logs.LogGroup(
            self, "apig_log_group", retention=logs.RetentionDays.ONE_MONTH
        )
        api = apig.RestApi(
            self,
            "apiGateway",
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
                    "https://" + distribution.distribution_domain_name,
                ],
                allow_credentials=True,
            ),
        )

        # API Validation models
        api.add_model(
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

        api.add_model(
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

        instanceid_commandid_model = api.add_model(
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

        instanceid_model = api.add_model(
            "InstanceIdModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "InstanceId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                },
            ),
        )

        username_groupname_model = api.add_model(
            "UsernameGroupnameModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "username": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                    "groupname": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                },
            ),
        )

        body_validator = apig.RequestValidator(
            self, "BodyValidator", rest_api=api, validate_request_body=True
        )

        api_models = api.root.add_resource("models")
        api_models.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=models_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        api_cars = api.root.add_resource("cars")

        api_users = api.root.add_resource("users")
        api_users.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=get_users_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # /admin
        api_admin = api.root.add_resource("admin")

        api_admin_quarantined_models = api_admin.add_resource("quarantinedmodels")
        api_admin_quarantined_models.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=quarantined_models_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # GET /admin/groups
        api_admin_groups = api_admin.add_resource("groups")
        api_admin_groups.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=get_groups_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # PUT /admin/groups
        api_admin_groups.add_method(
            http_method="PUT",
            integration=apig.LambdaIntegration(handler=put_groups_group_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # /admin/groups/{groupname}
        group = api_admin_groups.add_resource("{groupname}")

        # GET /admin/groups/{groupname}
        group.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=get_groups_group_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # DELETE /admin/groups/{groupname}
        group.add_method(
            http_method="DELETE",
            integration=apig.LambdaIntegration(handler=delete_groups_group_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # POST /admin/groups/{groupname}
        group.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=post_groups_group_user_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={"application/json": username_groupname_model},
            request_validator=body_validator,
        )

        # /admin/groups/{groupname}/{username}
        group_user = group.add_resource("{username}")

        # DELETE /admin/groups/{groupname}/{username}
        group_user.add_method(
            http_method="DELETE",
            integration=apig.LambdaIntegration(
                handler=delete_groups_group_user_function
            ),
            authorization_type=apig.AuthorizationType.IAM,
        )

        api_cars_upload = api_cars.add_resource("upload")
        api_cars_upload.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=upload_model_to_car_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={"application/json": instanceid_model},
            request_validator=body_validator,
        )

        api_cars_upload_status = api_cars_upload.add_resource("status")
        api_cars_upload_status.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(
                handler=upload_model_to_car_status_function
            ),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={"application/json": instanceid_commandid_model},
            request_validator=body_validator,
        )

        LabelPrinter(
            self,
            "LabelPrinter",
            api_cars_upload=api_cars_upload,
            api_instanceid_commandid_model=instanceid_commandid_model,
            api_body_validator=body_validator,
            logs_bucket=logs_bucket,
            helper_functions_layer=helper_functions_layer,
            powertools_layer=powertools_layer,
            powertools_log_level=powertools_log_level,
            lambda_architecture=lambda_architecture,
            lambda_runtime=lambda_runtime,
            lambda_bundling_image=lambda_bundling_image,
        )

        # Grant API Invoke permissions to admin users
        # TODO: Ensure only users in the correct group can call the API endpoints
        # https://aws.amazon.com/blogs/compute/secure-api-access-with-amazon-cognito-federated-identities-amazon-cognito-user-pools-and-amazon-api-gateway/
        idp.admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["execute-api:Invoke"],
                resources=[
                    api.arn_for_execute_api(method="GET", path="/models"),
                    api.arn_for_execute_api(method="GET", path="/cars/label"),
                    api.arn_for_execute_api(method="POST", path="/cars/upload"),
                    api.arn_for_execute_api(method="POST", path="/cars/upload/status"),
                    api.arn_for_execute_api(method="GET", path="/users"),
                    api.arn_for_execute_api(
                        method="GET", path="/admin/quarantinedmodels"
                    ),
                    api.arn_for_execute_api(method="GET", path="/admin/groups"),
                    api.arn_for_execute_api(method="POST", path="/admin/groups"),
                    api.arn_for_execute_api(method="DELETE", path="/admin/groups"),
                    api.arn_for_execute_api(method="GET", path="/admin/groups/*"),
                    api.arn_for_execute_api(method="POST", path="/admin/groups/*"),
                    api.arn_for_execute_api(method="DELETE", path="/admin/groups/*"),
                ],
            )
        )

        # RUM
        cw_rum_app_monitor = CwRumAppMonitor(
            self, "CwRumAppMonitor", domain_name=distribution.distribution_domain_name
        )
        # End RUM

        # Deploy Default Models
        s3_deployment.BucketDeployment(
            self,
            "ModelsDeploy",
            sources=[
                s3_deployment.Source.asset(
                    path="./backend/default_models",
                ),
            ],
            destination_bucket=models_bucket,
            destination_key_prefix=(
                "private/{}:00000000-0000-0000-0000-000000000000/default/models/"
                .format(stack.region)
            ),
            retain_on_delete=False,
        )

        # Leaderboard
        Leaderboard(self, "Leaderboard", user_pool=idp.user_pool, api=appsync_api.api)

        idp.admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["appsync:GraphQL"],
                resources=[f"{appsync_api.api.arn}/*"],
            )
        )

        # TODO move this to the leaderboard construct
        idp.unauthenticated_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["appsync:GraphQL"],
                resources=[
                    f"{appsync_api.api.arn}/types/Subscription/fields/onNewOverlayInfo"
                ],
            )
        )

        # Outputs
        CfnOutput(
            self, "CFURL", value="https://" + distribution.distribution_domain_name
        )

        self.sourceBucketName = CfnOutput(
            self, "sourceBucketName", value=source_bucket.bucket_name
        )

        self.distributionId = CfnOutput(
            self, "distributionId", value=distribution.distribution_id
        )

        self.stackRegion = CfnOutput(self, "stackRegion", value=stack.region)

        CfnOutput(self, "region", value=stack.region)

        self.apiUrl = CfnOutput(self, "apiUrl", value=api.url)

        CfnOutput(self, "modelsBucketName", value=models_bucket.bucket_name)

        CfnOutput(self, "infectedBucketName", value=infected_bucket.bucket_name)

        CfnOutput(self, "rumScript", value=cw_rum_app_monitor.script)

        CfnOutput(self, "appsyncEndpoint", value=appsync_api.api.graphql_url)

        CfnOutput(self, "appsyncId", value=appsync_api.api.api_id)
