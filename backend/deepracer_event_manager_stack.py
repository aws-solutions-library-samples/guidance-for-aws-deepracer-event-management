from aws_cdk import (
    Stack,
    RemovalPolicy,
    Duration,
    CfnOutput,
    DockerImage,
    aws_s3 as s3,
    aws_s3_deployment as s3_deployment,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfront_origins,
    aws_cognito as cognito,
    aws_iam as iam,
    aws_lambda_python_alpha as lambda_python,
    aws_lambda as awslambda,
    aws_apigateway as apig,
    aws_lambda_destinations as lambda_destinations,
    aws_logs as logs,
)
from constructs import Construct

from backend.cwrum_construct import CwRumAppMonitor
from backend.user_pool_user import UserPoolUser
from cdk_serverless_clamscan import ServerlessClamscan

from cdk_nag import NagSuppressions

class CdkDeepRacerEventManagerStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, email: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        ## setup for pseudo parameters
        stack = Stack.of(self)

        ## Logs Bucket
        logs_bucket = s3.Bucket(self, 'logs_bucket',
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_prefix='access-logs/logs_bucket/',
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=Duration.days(30)
                ),
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1)
                )
            ]
        )

        logs_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[
                    logs_bucket.bucket_arn,
                    logs_bucket.bucket_arn + '/*'
                ],
                conditions={
                    "NumericLessThan": {
                        "s3:TlsVersion": "1.2"
                    }
                }
            )
        )

        # Upload S3 bucket
        models_bucket = s3.Bucket(self, 'models_bucket',
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=logs_bucket,
            server_access_logs_prefix='access-logs/models_bucket/',
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=Duration.days(15),
                    tag_filters={
                        'lifecycle': 'true'
                    }
                ),
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1)
                )
            ]
        )

        models_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[
                    models_bucket.bucket_arn,
                    models_bucket.bucket_arn + '/*'
                ],
                conditions={
                    "NumericLessThan": {
                        "s3:TlsVersion": "1.2"
                    }
                }
            )
        )

        infected_bucket = s3.Bucket(self, 'infected_bucket',
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=logs_bucket,
            server_access_logs_prefix='access-logs/infected_bucket/',
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=Duration.days(1)
                ),
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1)
                )
            ]
        )

        infected_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[
                    infected_bucket.bucket_arn,
                    infected_bucket.bucket_arn + '/*'
                ],
                conditions={
                    "NumericLessThan": {
                        "s3:TlsVersion": "1.2"
                    }
                }
            )
        )

        ### Lambda
        ## Common Config
        lambda_architecture = awslambda.Architecture.ARM_64
        lambda_runtime = awslambda.Runtime.PYTHON_3_9
        lambda_bundling_image = DockerImage.from_registry('public.ecr.aws/sam/build-python3.9:latest-arm64')

        ## Layers
        helper_functions_layer = lambda_python.PythonLayerVersion(self, 'helper_functions_v2',
            entry="backend/lambdas/helper_functions_layer/http_response/",
            compatible_architectures=[
                lambda_architecture
            ],
            compatible_runtimes=[
                lambda_runtime
            ],
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            )
        )

        powertools_layer = lambda_python.PythonLayerVersion.from_layer_version_arn(self, 'lambda_powertools',
            layer_version_arn='arn:aws:lambda:{}:017000801446:layer:AWSLambdaPowertoolsPython:33'.format(stack.region)
        )

        ## Functions

        delete_infected_files_function = lambda_python.PythonFunction(self, "delete_infected_files_function",
            entry="backend/lambdas/delete_infected_files_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=256,
            architecture=lambda_architecture,
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer],
            environment={
                'MODELS_S3_BUCKET': models_bucket.bucket_name,
                'INFECTED_S3_BUCKET': infected_bucket.bucket_name,
            }
        )

        models_bucket.grant_read_write(delete_infected_files_function, '*')
        infected_bucket.grant_read_write(delete_infected_files_function, '*')

        #add clam av scan to S3 uploads bucket
        bucketList = [ models_bucket ]
        sc = ServerlessClamscan(self, "rClamScan",
            buckets=bucketList,
            on_result=lambda_destinations.LambdaDestination(delete_infected_files_function),
            on_error=lambda_destinations.LambdaDestination(delete_infected_files_function),
        )

        ## Models Function
        models_function = lambda_python.PythonFunction(self, "get_models_function",
            entry="backend/lambdas/get_models_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "bucket": models_bucket.bucket_name
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )

        #permissions for s3 bucket read
        models_bucket.grant_read(models_function, 'private/*')

        ## Quarantine Models Function
        quarantined_models_function = lambda_python.PythonFunction(self, "get_quarantined_models_function",
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
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer]
        )

        #permissions for s3 bucket read
        infected_bucket.grant_read(quarantined_models_function, 'private/*')

        ## Cars Function
        cars_function = lambda_python.PythonFunction(self, "get_cars_function",
            entry="backend/lambdas/get_cars_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        cars_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:DescribeInstanceInformation"
                ],
                resources=["*"],
            )
        )

        ## upload_model_to_car_function
        upload_model_to_car_function = lambda_python.PythonFunction(self, "upload_model_to_car_function",
            entry="backend/lambdas/upload_model_to_car_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "bucket": models_bucket.bucket_name
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
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

        ## upload_model_to_car_function
        upload_model_to_car_status_function = lambda_python.PythonFunction(self, "upload_model_to_car_status_function",
            entry="backend/lambdas/upload_model_to_car_status_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
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
        #permissions for s3 bucket read
        models_bucket.grant_read(upload_model_to_car_function, 'private/*')

        ## delete_all_models_from_car_function
        delete_all_models_from_car_function = lambda_python.PythonFunction(self, "delete_all_models_from_car_function",
            entry="backend/lambdas/delete_all_models_from_car_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=256,
            architecture=lambda_architecture,
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        delete_all_models_from_car_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:GetCommandInvocation",
                    "ssm:SendCommand",
                ],
                resources=["*"],
            )
        )

        ## create ssm activation function
        create_ssm_activation_function = lambda_python.PythonFunction(self, "create_ssm_activation_function",
            entry="backend/lambdas/create_ssm_activation_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        create_ssm_activation_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "iam:PassRole",
                    "ssm:AddTagsToResource",
                    "ssm:CreateActivation"
                ],
                resources=["*"],
            )
        )

        ### Website

        ## S3
        source_bucket = s3.Bucket(self, "Bucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=logs_bucket,
            server_access_logs_prefix='access-logs/source_bucket/',
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
                resources=[
                    source_bucket.bucket_arn,
                    source_bucket.bucket_arn + '/*'
                ],
                conditions={
                    "NumericLessThan": {
                        "s3:TlsVersion": "1.2"
                    }
                }
            )
        )

        ## CloudFront and OAI
        ## L2 Experimental variant CF + OAI
        origin_access_identity = cloudfront.OriginAccessIdentity(self, "OAI",
            comment=stack.stack_name
        )

        distribution = cloudfront.Distribution(self, "Distribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=cloudfront_origins.S3Origin(
                    bucket=source_bucket,
                    origin_access_identity=origin_access_identity
                ),
                response_headers_policy=cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS,
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            ),
            http_version=cloudfront.HttpVersion.HTTP2_AND_3,
            default_root_object="index.html",
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
            log_bucket=logs_bucket,
            log_file_prefix='access-logs/cf_distribution/',
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html"
                ),
                # cloudfront.ErrorResponse(
                #     http_status=404,
                #     response_http_status=200,
                #     response_page_path="/errors/404.html"
                # )
            ]
        )

        NagSuppressions.add_resource_suppressions(distribution,
            suppressions=[{
                "id": 'AwsSolutions-CFR1',
                "reason": 'Cloudfront geo restriction not needed for DREM use case'
            },
            {
                "id":'AwsSolutions-CFR2',
                "reason":'DREM use case does not warrant for usage of AWS WAF'
            }
            ]
        )

        self.distribution = distribution

        models_bucket.add_cors_rule(
            allowed_headers=["*"],
            allowed_methods=[
                s3.HttpMethods.PUT,
                s3.HttpMethods.POST,
                s3.HttpMethods.GET,
                s3.HttpMethods.HEAD,
                s3.HttpMethods.DELETE
            ],
            allowed_origins=[
                "*",
                #"http://localhost:3000",
                #"https://" + distribution.distribution_domain_name
            ],
            exposed_headers=[
                "x-amz-server-side-encryption",
                "x-amz-request-id",
                "x-amz-id-2",
                "ETag"
            ],
            max_age=3000
        )

        # cors=[s3.CorsRule(
        #     allowed_headers=["*"],
        #     allowed_methods=[s3.HttpMethods.PUT],
        #     allowed_origins=[cors_internal_domain, 'https://'+api.rest_api_id+'.execute-api.'+cdk_stack.region+'.amazonaws.com'])
        # ]

        ## Cognito User Pool
        user_pool = cognito.UserPool(self, "UserPool",
            user_pool_name=stack.stack_name,
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True)
            ),
            mfa=cognito.Mfa.OFF,
            self_sign_up_enabled=True,
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            removal_policy=RemovalPolicy.DESTROY,
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
                temp_password_validity=Duration.days(2)
            ),
            user_invitation=cognito.UserInvitationConfig(
                email_subject="Invite to join DREM",
                email_body="Hello {username}, you have been invited to join DREM. \nYour temporary password is \n\n{####}\n\n" + "https://" + distribution.distribution_domain_name,
                sms_message="Hello {username}, your temporary password for DREM is {####}"
            ),
            user_verification=cognito.UserVerificationConfig(
                email_subject="Verify your email for DREM",
                email_body="Thanks for signing up to DREM \n\nYour verification code is \n{####}",
                email_style=cognito.VerificationEmailStyle.CODE,
                sms_message="Thanks for signing up to DREM. Your verification code is {####}"
            )
        )

        NagSuppressions.add_resource_suppressions(user_pool,
            suppressions=[{
                "id": 'AwsSolutions-COG2',
                "reason": 'users only sign up and us DREM for a short period of time, all users are deleted after 10 days inactivity'
            },
            {
                "id":'AwsSolutions-COG3',
                "reason":'users only sign up and us DREM for a short period of time, all users are deleted after 10 days inactivity'
            }
            ]
        )

        ## Cognito Client
        user_pool_client_web = cognito.UserPoolClient(self, "UserPoolClientWeb",
            user_pool=user_pool,
            prevent_user_existence_errors=True
        )

        cfn_user_pool_client_web = user_pool_client_web.node.default_child
        cfn_user_pool_client_web.callback_ur_ls=["https://" + distribution.distribution_domain_name,"http://localhost:3000"]
        cfn_user_pool_client_web.logout_ur_ls=["https://" + distribution.distribution_domain_name,"http://localhost:3000"]

        ## Cognito Identity Pool
        identity_pool = cognito.CfnIdentityPool(self, "IdentityPool",
            allow_unauthenticated_identities=False,
            cognito_identity_providers=[
                cognito.CfnIdentityPool.CognitoIdentityProviderProperty(
                    client_id=user_pool_client_web.user_pool_client_id,
                    provider_name=user_pool.user_pool_provider_name
                )
            ]
        )

        ## Cognito Identity Pool Authenitcated Role
        id_pool_auth_user_role = iam.Role(self, "CognitoDefaultAuthenticatedRole",
            assumed_by=iam.FederatedPrincipal(
                federated="cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity"
            )
        )

        ##read/write own bucket only
        id_pool_auth_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:ListBucket",
                ],
                resources=[models_bucket.bucket_arn],
                conditions={
                    "StringLike": {
                        "s3:prefix": ["private/${cognito-identity.amazonaws.com:sub}/*"],
                    },
                }
            )
        )

        id_pool_auth_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:PutObjectTagging"
                ],
                resources=[
                    models_bucket.bucket_arn + "/private/${cognito-identity.amazonaws.com:sub}",
                    models_bucket.bucket_arn + "/private/${cognito-identity.amazonaws.com:sub}/*",
                ],
            )
        )

        # ## Cognito Identity Pool Unauthenitcated Role
        # id_pool_unauth_user_role = iam.Role(self, "CognitoDefaultUnauthenticatedRole",
        #     assumed_by=iam.FederatedPrincipal(
        #         federated="cognito-identity.amazonaws.com",
        #         conditions={
        #             "StringEquals": {
        #                 "cognito-identity.amazonaws.com:aud": identity_pool.ref,
        #             },
        #             "ForAnyValue:StringLike": {
        #                 "cognito-identity.amazonaws.com:amr": "unauthenticated",
        #             },
        #         },
        #         assume_role_action="sts:AssumeRoleWithWebIdentity"
        #     )
        # )

        cognito.CfnIdentityPoolRoleAttachment(self, "IdentityPoolRoleAttachment",
            identity_pool_id=identity_pool.ref,
            roles={
                "authenticated": id_pool_auth_user_role.role_arn,
                #"unauthenticated": id_pool_unauth_user_role.role_arn,
            },
            role_mappings={
                "role_mapping": cognito.CfnIdentityPoolRoleAttachment.RoleMappingProperty(
                    type="Token",
                    identity_provider='{}:{}'.format(user_pool.user_pool_provider_name,user_pool_client_web.user_pool_client_id),
                    ambiguous_role_resolution='AuthenticatedRole'
                )
            },
        )

        ## Admin Users Group Role
        admin_user_role = iam.Role(self, "AdminUserRole",
            assumed_by=iam.FederatedPrincipal(
                federated="cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity"
            )
        )

        models_bucket.grant_read(admin_user_role, '*')

        ##read/write own bucket only
        admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:ListBucket",
                ],
                resources=[models_bucket.bucket_arn],
                conditions={
                    "StringLike": {
                        "s3:prefix": ["private/${cognito-identity.amazonaws.com:sub}/*"],
                    },
                }
            )
        )

        admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:PutObjectTagging"
                ],
                resources=[
                    models_bucket.bucket_arn + "/private/${cognito-identity.amazonaws.com:sub}",
                    models_bucket.bucket_arn + "/private/${cognito-identity.amazonaws.com:sub}/*",
                ],
            )
        )

        # Cognito User Group (Admin)
        user_pool_group = cognito.CfnUserPoolGroup(self, "AdminGroup",
            user_pool_id=user_pool.user_pool_id,
            description="Admin user group",
            group_name="admin",
            role_arn=admin_user_role.role_arn,
            precedence=1
        )

        # Lambda
        ## List users Function
        get_users_function = lambda_python.PythonFunction(self, "get_users_function",
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
                "user_pool_id": user_pool.user_pool_id
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        get_users_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:ListUsers",
                ],
                resources=[
                    user_pool.user_pool_arn
                ]
            )
        )

        ## GET groups users Function
        get_groups_group_function = lambda_python.PythonFunction(self, "get_groups_group_function",
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
                "user_pool_id": user_pool.user_pool_id
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        get_groups_group_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:ListUsersInGroup",
                ],
                resources=[
                    user_pool.user_pool_arn
                ]
            )
        )

        ## Post groups group user Function
        post_groups_group_user_function = lambda_python.PythonFunction(self, "post_groups_group_user_function",
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
                "user_pool_id": user_pool.user_pool_id
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        post_groups_group_user_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:AdminAddUserToGroup",
                ],
                resources=[
                    user_pool.user_pool_arn
                ]
            )
        )

        ## Delete groups group user Function
        delete_groups_group_user_function = lambda_python.PythonFunction(self, "delete_groups_group_user_function",
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
                "user_pool_id": user_pool.user_pool_id
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        delete_groups_group_user_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:AdminRemoveUserFromGroup",
                ],
                resources=[
                    user_pool.user_pool_arn
                ]
            )
        )

        # Get groups Function
        get_groups_function = lambda_python.PythonFunction(self, "get_groups_function",
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
                "user_pool_id": user_pool.user_pool_id
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        get_groups_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:ListGroups",
                ],
                resources=[
                    user_pool.user_pool_arn
                ]
            )
        )

        ## Put groups group Function
        put_groups_group_function = lambda_python.PythonFunction(self, "put_groups_group_function",
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
                "user_pool_id": user_pool.user_pool_id
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        put_groups_group_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:CreateGroup",
                ],
                resources=[
                    user_pool.user_pool_arn
                ]
            )
        )

        ## Delete groups group Function
        delete_groups_group_function = lambda_python.PythonFunction(self, "delete_groups_group_function",
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
                "user_pool_id": user_pool.user_pool_id
            },
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[helper_functions_layer, powertools_layer]
        )
        delete_groups_group_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:DeleteGroup",
                ],
                resources=[
                    user_pool.user_pool_arn
                ]
            )
        )

         # Add a default Admin user to the system
        default_admin_user_name = 'admin'
        default_admin_email = email

        UserPoolUser(self, 'DefaultAdminUser',
            username=default_admin_user_name,
            email=default_admin_email,
            user_pool=user_pool,
            group_name=user_pool_group.ref
        )

        ## API Gateway
        apig_log_group = logs.LogGroup(self, "apig_log_group",
            retention=logs.RetentionDays.ONE_MONTH
        )
        api = apig.RestApi(self, 'apiGateway',
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
                    user=True
                ),
                logging_level=apig.MethodLoggingLevel.ERROR
            ),
            default_cors_preflight_options=apig.CorsOptions(
                allow_origins=[
                    "http://localhost:3000",
                    "https://" + distribution.distribution_domain_name
                ],
                allow_credentials=True
            )
        )

        #API Validation models
        hostname_model = api.add_model("hostanameModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "hostname": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                }
            )
        )

        username_model = api.add_model("UsernameModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "username": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                }
            )
        )

        instanceid_commandid_model = api.add_model("IanstanceIdCommandIdModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "InstanceId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                    "CommandId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                }
            )
        )

        instanceid_model = api.add_model("InstanceIdModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "InstanceId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                }
            )
        )

        username_groupname_model = api.add_model("UsernameGroupnameModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "username": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                    "groupname": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                }
            )
        )

        body_validator = apig.RequestValidator(self, 'BodyValidator',
            rest_api=api,
            validate_request_body=True
        )


        api_models = api.root.add_resource('models')
        models_method = api_models.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=models_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        api_cars = api.root.add_resource('cars')
        cars_method = api_cars.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=cars_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        api_users = api.root.add_resource('users')
        users_method = api_users.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=get_users_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        # /admin
        api_admin = api.root.add_resource('admin')

        api_admin_quarantined_models = api_admin.add_resource('quarantinedmodels')
        quarantined_models_method = api_admin_quarantined_models.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=quarantined_models_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        # GET /admin/groups
        api_admin_groups = api_admin.add_resource('groups')
        api_admin_groups.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=get_groups_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        # PUT /admin/groups
        api_admin_groups.add_method(
            http_method="PUT",
            integration=apig.LambdaIntegration(handler=put_groups_group_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        # /admin/groups/{groupname}
        group = api_admin_groups.add_resource("{groupname}")

        # GET /admin/groups/{groupname}
        group.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=get_groups_group_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        # DELETE /admin/groups/{groupname}
        group.add_method(
            http_method="DELETE",
            integration=apig.LambdaIntegration(handler=delete_groups_group_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        # POST /admin/groups/{groupname}
        group.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=post_groups_group_user_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={
                "application/json": username_groupname_model
            },
            request_validator=body_validator
        )

        # /admin/groups/{groupname}/{username}
        group_user = group.add_resource("{username}")

        # DELETE /admin/groups/{groupname}/{username}
        group_user.add_method(
            http_method="DELETE",
            integration=apig.LambdaIntegration(handler=delete_groups_group_user_function),
            authorization_type=apig.AuthorizationType.IAM
        )


        api_cars_upload = api_cars.add_resource('upload')
        cars_upload_method = api_cars_upload.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=upload_model_to_car_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={
                "application/json": instanceid_model
            },
            request_validator=body_validator
        )


        api_cars_delete_all_models = api_cars.add_resource('delete_all_models')
        cars_delete_all_models_method = api_cars_delete_all_models.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=delete_all_models_from_car_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={
                "application/json": instanceid_model
            },
            request_validator=body_validator
        )


        ### Create SSM Activation Method
        api_cars_create_ssm_activation = api_cars.add_resource('create_ssm_activation')
        api_cars_create_ssm_activation_method = api_cars_create_ssm_activation.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=create_ssm_activation_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={
                "application/json": hostname_model
            },
            request_validator=body_validator
        )

        api_cars_upload_status = api_cars_upload.add_resource('status')
        cars_upload_staus_method = api_cars_upload_status.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=upload_model_to_car_status_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={
                "application/json": instanceid_commandid_model
            },
            request_validator=body_validator
        )

        ## Grant API Invoke permissions to admin users
        # TODO: Ensure only users in the correct group can call the API endpoints
        # https://aws.amazon.com/blogs/compute/secure-api-access-with-amazon-cognito-federated-identities-amazon-cognito-user-pools-and-amazon-api-gateway/
        admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "execute-api:Invoke"
                ],
                resources=[
                    api.arn_for_execute_api(method='GET',path='/models'),
                    api.arn_for_execute_api(method='GET',path='/cars'),
                    api.arn_for_execute_api(method='POST',path='/cars/upload'),
                    api.arn_for_execute_api(method='POST',path='/cars/upload/status'),
                    api.arn_for_execute_api(method='POST',path='/cars/delete_all_models'),
                    api.arn_for_execute_api(method='POST',path='/cars/create_ssm_activation'),
                    api.arn_for_execute_api(method='GET',path='/users'),
                    api.arn_for_execute_api(method='GET',path='/admin/quarantinedmodels'),
                    api.arn_for_execute_api(method='GET',path='/admin/groups'),
                    api.arn_for_execute_api(method='POST',path='/admin/groups'),
                    api.arn_for_execute_api(method='DELETE',path='/admin/groups'),
                    api.arn_for_execute_api(method='GET',path='/admin/groups/*'),
                    api.arn_for_execute_api(method='POST',path='/admin/groups/*'),
                    api.arn_for_execute_api(method='DELETE',path='/admin/groups/*'),
                ],
            )
        )

        ## RUM
        cw_rum_app_monitor = CwRumAppMonitor(self, 'CwRumAppMonitor',
            domain_name=distribution.distribution_domain_name
        )
        ## End RUM

        ## Deploy Default Models
        models_deployment = s3_deployment.BucketDeployment(self, 'ModelsDeploy',
            sources= [
                s3_deployment.Source.asset(
                    path='./backend/default_models',
                ),
            ],
            destination_bucket=models_bucket,
            destination_key_prefix='private/{}:00000000-0000-0000-0000-000000000000/default/models/'.format(stack.region),
            retain_on_delete=False,
        )

        ## Outputs
        CfnOutput(
            self, "CFURL",
            value="https://" + distribution.distribution_domain_name
        )

        CfnOutput(
            self, "DefaultAdminUserUsername",
            value=default_admin_user_name
        )

        CfnOutput(
            self, "DefaultAdminEmail",
            value=default_admin_email
        )

        self.sourceBucketName = CfnOutput(
            self, "sourceBucketName",
            value=source_bucket.bucket_name
        )

        self.distributionId = CfnOutput(
            self, "distributionId",
            value=distribution.distribution_id
        )

        self.stackRegion = CfnOutput(
            self, "stackRegion",
            value=stack.region
        )

        CfnOutput(
            self, "region",
            value=stack.region
        )

        self.userPoolId = CfnOutput(
            self, "userPoolId",
            value=user_pool.user_pool_id
        )

        self.userPoolWebClientId = CfnOutput(
            self, "userPoolWebClientId",
            value=user_pool_client_web.user_pool_client_id
        )

        self.identityPoolId = CfnOutput(
            self, "identityPoolId",
            value=identity_pool.ref
        )

        self.apiUrl = CfnOutput(
            self, "apiUrl",
            value=api.url
        )

        CfnOutput(
            self, "modelsBucketName",
            value=models_bucket.bucket_name
        )

        CfnOutput(
            self, "infectedBucketName",
            value=infected_bucket.bucket_name
        )

        CfnOutput(
            self, "rumScript",
            value=cw_rum_app_monitor.script
        )
