from aws_cdk import (
    Stack,
    RemovalPolicy,
    Duration,
    CfnOutput,
    aws_s3 as s3,
    aws_s3_notifications as s3_notifications,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfront_origins,
    aws_cognito as cognito,
    aws_iam as iam,
    aws_lambda_python_alpha as lambda_python,
    aws_lambda as awslambda,
    aws_dynamodb as dynamodb,
    aws_apigateway as apig,
    aws_rum as rum,
    aws_events as events,
    aws_events_targets as events_targets,
    aws_sns as sns
)
from constructs import Construct

from backend.cwrum_construct import CwRumAppMonitor
from backend.UserPoolUser import UserPoolUser
from cdk_serverless_clamscan import ServerlessClamscan

class CdkDeepRacerEventManagerStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        ## setup for pseudo parameters
        stack = Stack.of(self)

        # Upload S3 bucket
        models_bucket = s3.Bucket(self, 'models_bucket',
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=True,
                block_public_policy=True,
                ignore_public_acls=True,
                restrict_public_buckets=True
            ),
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1),
                    expiration=Duration.days(15)
                )
            ]
        )

        #add clam av scan to S3 uploads bucket
        bucketList = [ models_bucket ]
        sc = ServerlessClamscan(self, "rClamScan",
            buckets=bucketList,
        )
        infected_topic = sns.Topic(self, "rInfectedTopic")
        if sc.infected_rule != None:
            sc.infected_rule.add_target(
                events_targets.SnsTopic(
                    infected_topic,
                    message=events.RuleTargetInput.from_event_path('$.detail.responsePayload.message'),
                )
            )

        ### Lambda
        ## Models Function
        models_function = lambda_python.PythonFunction(self, "get_models_function",
            entry="backend/lambdas/get_models_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=awslambda.Runtime.PYTHON_3_8,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=awslambda.Architecture.ARM_64,
            environment={
                "bucket": models_bucket.bucket_name
            }
        )

        #permissions for s3 bucket read
        models_bucket.grant_read(models_function, 'private/*')

        ## Cars Function
        cars_function = lambda_python.PythonFunction(self, "get_cars_function",
            entry="backend/lambdas/get_cars_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=awslambda.Runtime.PYTHON_3_8,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=awslambda.Architecture.ARM_64
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
            runtime=awslambda.Runtime.PYTHON_3_8,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=awslambda.Architecture.ARM_64,
            environment={
                "bucket": models_bucket.bucket_name
            }
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
            runtime=awslambda.Runtime.PYTHON_3_8,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=awslambda.Architecture.ARM_64,
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
            runtime=awslambda.Runtime.PYTHON_3_8,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=256,
            architecture=awslambda.Architecture.ARM_64
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
            runtime=awslambda.Runtime.PYTHON_3_8,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=awslambda.Architecture.ARM_64
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
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=True,
                block_public_policy=True,
                ignore_public_acls=True,
                restrict_public_buckets=True
            ),
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
        )
        self.source_bucket = source_bucket

        ## CloudFront and OAI
        ## L2 Experimental variant CF + OAI
        origin_access_identity = cloudfront.OriginAccessIdentity(self, "OAI",
            comment=stack.stack_name
        )

        distribution = cloudfront.CloudFrontWebDistribution(self, "Distribution",
            origin_configs=[{
                "behaviors": [{
                    "isDefaultBehavior": True
                }],
                "s3OriginSource": {
                    "s3BucketSource": source_bucket,
                    "originAccessIdentity": origin_access_identity
                },
            }],
            error_configurations=[
                {
                    "errorCode": 403,
                    "responseCode": 200,
                    "responsePagePath": "/index.html"
                },
            #     {
            #         "errorCode": 404,
            #         "responseCode": 200,
            #         "responsePagePath": "/errors/404.html"
            #     }
            ],
            default_root_object="index.html",
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
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

        id_pool_auth_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "mobileanalytics:PutEvents",
                    "cognito-sync:*",
                    "cognito-identity:*",
                ],
                resources=["*"],
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
                ],
                resources=[
                    models_bucket.bucket_arn + "/private/${cognito-identity.amazonaws.com:sub}",
                    models_bucket.bucket_arn + "/private/${cognito-identity.amazonaws.com:sub}/*",
                ],
            )
        )

        ## Cognito Identity Pool Unauthenitcated Role
        id_pool_unauth_user_role = iam.Role(self, "CognitoDefaultUnauthenticatedRole",
            assumed_by=iam.FederatedPrincipal(
                federated="cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "unauthenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity"
            )
        )

        cognito.CfnIdentityPoolRoleAttachment(self, "IdentityPoolRoleAttachment",
            identity_pool_id=identity_pool.ref,
            roles={
                "authenticated": id_pool_auth_user_role.role_arn,
                "unauthenticated": id_pool_unauth_user_role.role_arn,
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

        admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "mobileanalytics:PutEvents",
                    "cognito-sync:*",
                    "cognito-identity:*",
                ],
                resources=["*"],
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

        # Add a default Admin user to the system
        UserPoolUser(self, 'DefaulAdminUser',
            username='Admin',
            password='DeepRacer0!',
            user_pool=user_pool,
            group_name=user_pool_group.ref
        )

        # API Gateway
        api = apig.RestApi(self, 'apiGateway',
            rest_api_name=stack.stack_name,
            deploy_options=apig.StageOptions(
                throttling_rate_limit=10,
                throttling_burst_limit=20,
                tracing_enabled=True
            ),
            default_cors_preflight_options=apig.CorsOptions(
                allow_origins=[
                    "http://localhost:3000",
                    "https://" + distribution.distribution_domain_name
                ],
                allow_credentials=True
            )
        )

        api_models = api.root.add_resource('models')
        crud_models_method = api_models.add_method(
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

        api_cars_upload = api_cars.add_resource('upload')
        cars_upload_method = api_cars_upload.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=upload_model_to_car_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        api_cars_delete_all_models = api_cars.add_resource('delete_all_models')
        cars_delete_all_models_method = api_cars_delete_all_models.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=delete_all_models_from_car_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        api_cars_create_ssm_activation = api_cars.add_resource('create_ssm_activation')
        api_cars_create_ssm_activation_method = api_cars_create_ssm_activation.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=create_ssm_activation_function),
            authorization_type=apig.AuthorizationType.IAM
        )

        api_cars_upload_status = api_cars_upload.add_resource('status')
        cars_upload_staus_method = api_cars_upload_status.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=upload_model_to_car_status_function),
            authorization_type=apig.AuthorizationType.IAM
        )


        ## Grant API Invoke permissions to admin users
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
                ],
            )
        )

        ## RUM
        cw_rum_app_monitor = CwRumAppMonitor(self, 'CwRumAppMonitor',
            domain_name=distribution.distribution_domain_name
        )

        ## End RUM

        ## Outputs
        CfnOutput(
            self, "CFURL",
            value="https://" + distribution.distribution_domain_name
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
            self, "rumScript",
            value=cw_rum_app_monitor.script
        )
