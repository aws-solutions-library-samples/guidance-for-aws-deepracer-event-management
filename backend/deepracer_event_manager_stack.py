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

from backend.constructs.cwrum_construct import CwRumAppMonitor
from backend.constructs.user_management_construct import UserManagement
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

        ## API Gateway
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

        self.userManagement = UserManagement(self, 'UserManagement', distribution, models_bucket, api)

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

        # self.userPoolId = CfnOutput(
        #     self, "userPoolId",
        #     value=user_pool.user_pool_id
        # )

        # self.userPoolWebClientId = CfnOutput(
        #     self, "userPoolWebClientId",
        #     value=user_pool_client_web.user_pool_client_id
        # )

        # self.identityPoolId = CfnOutput(
        #     self, "identityPoolId",
        #     value=identity_pool.ref
        # )

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
