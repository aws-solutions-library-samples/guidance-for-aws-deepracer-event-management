from aws_cdk import (
    core as cdk,
    aws_s3 as s3,
    aws_s3_notifications as s3_notifications,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfront_origins,
    aws_cognito as cognito,
    aws_iam as iam,
    aws_lambda_python as lambda_python,
    aws_lambda as awslambda,
    aws_dynamodb as dynamodb,
    aws_apigateway as apig,
)

class CdkDeepRacerEventManagerStack(cdk.Stack):

    def __init__(self, scope: cdk.Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        ## setup for pseudo parameters
        stack = cdk.Stack.of(self)

        # Upload S3 bucket
        models_bucket = s3.Bucket(self, 'models_bucket',
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=True,
                block_public_policy=True,
                ignore_public_acls=True,
                restrict_public_buckets=True
            ),
            auto_delete_objects=True,
            removal_policy=cdk.RemovalPolicy.DESTROY,
            lifecycle_rules=[s3.LifecycleRule(
                expiration=cdk.Duration.days(7),
                prefix='uploads/'
            )]
        )

        ### Lambda
        ## Models Function 
        models_function = lambda_python.PythonFunction(self, "get_models_function",
            entry="lambda/get_models_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=cdk.Duration.minutes(1),
            runtime=awslambda.Runtime.PYTHON_3_8,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=1024
        )

        #permissions for s3 bucket read
        models_bucket.grant_read_write(models_function, 'uploads/*')

        ## Website

        ## S3
        source_bucket = s3.Bucket(self, "Bucket",
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=True,
                block_public_policy=True,
                ignore_public_acls=True,
                restrict_public_buckets=True
            )
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
            # error_configurations=[
            #     {
            #         "errorCode": 403,
            #         "responseCode": 200,
            #         "responsePagePath": "/errors/403.html"
            #     },
            #     {
            #         "errorCode": 404,
            #         "responseCode": 200,
            #         "responsePagePath": "/errors/404.html"
            #     }                
            # ],
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
                #"https://" + distribution.domain_name
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
            self_sign_up_enabled=False
        )

        ## Cognito Client
        user_pool_client_web = cognito.UserPoolClient(self, "UserPoolClientWeb",
            user_pool=user_pool
        )

        cfn_user_pool_client_web = user_pool_client_web.node.default_child
        cfn_user_pool_client_web.callback_ur_ls=["https://" + distribution.domain_name,"http://localhost:3000"]
        cfn_user_pool_client_web.logout_ur_ls=["https://" + distribution.domain_name,"http://localhost:3000"]

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

        models_bucket.grant_read_write(id_pool_auth_user_role, '*')

        cognito.CfnIdentityPoolRoleAttachment(self, "IdentityPoolRoleAttachment",
            identity_pool_id=identity_pool.ref,
            roles={
                "authenticated": id_pool_auth_user_role.role_arn
            }
        )


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
                    "https://" + distribution.domain_name
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
        # crud_images_method = api_images.add_method(
        #     http_method="DELETE",
        #     integration=apig.LambdaIntegration(handler=crud_images_function),
        #     authorization_type=apig.AuthorizationType.IAM
        # )

        ## Grant API Invoke permissions to the Default authenticated user 
        # https://aws.amazon.com/blogs/compute/secure-api-access-with-amazon-cognito-federated-identities-amazon-cognito-user-pools-and-amazon-api-gateway/
        id_pool_auth_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "execute-api:Invoke"
                ],
                resources=[
                    api.arn_for_execute_api(method='GET',path='/models'),
                ],
            )
        )

        ## Outputs
        cdk.CfnOutput(
            self, "CFURL",
            value="https://" + distribution.domain_name
        )

        cdk.CfnOutput(
            self, "region",
            value=stack.region
        )

        cdk.CfnOutput(
            self, "userPoolId",
            value=user_pool.user_pool_id
        )

        cdk.CfnOutput(
            self, "userPoolWebClientId",
            value=user_pool_client_web.user_pool_client_id
        )

        cdk.CfnOutput(
            self, "identityPoolId",
            value=identity_pool.ref
        )

        cdk.CfnOutput(
            self, "modelsBucketName",
            value=models_bucket.bucket_name
        )


