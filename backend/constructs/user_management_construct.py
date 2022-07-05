from aws_cdk import (
    Stack,
    RemovalPolicy,
    CfnOutput,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cognito as cognito,
    aws_iam as iam,
    aws_apigateway as apig,
    custom_resources,
)

from constructs import Construct

from backend.constructs.default_admin_user_construct import DefaultAdminUser


def default_admin_user_custom_resource(self, name: str): 
    on_create_aws_sdk_call=custom_resources.AwsSdkCall(
        physical_resource_id=custom_resources.PhysicalResourceId.from_response('AppMonitor.Id'),
        service="RUM",
        action="getAppMonitor", # https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RUM.html#getAppMonitor-property
        parameters={
            "Name": name,
        }
    )

    custom_resource = custom_resources.AwsCustomResource(self, "CwRum_custom_resource",
        policy=custom_resources.AwsCustomResourcePolicy.from_sdk_calls(
            resources=custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE
        ),
        on_create=on_create_aws_sdk_call,
        on_update=on_create_aws_sdk_call,
    )

    app_monitor_id = custom_resource.get_response_field('AppMonitor.Id')
    return app_monitor_id

class UserManagement(Construct):

    def __init__(self, scope: Construct, id: str, distribution: cloudfront.CloudFrontWebDistribution, models_bucket: s3.Bucket, api: apig.RestApi, **kwargs):
        super().__init__(scope, id, **kwargs)

        ## setup for pseudo parameters
        stack = Stack.of(self)

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

        ## Grant API Invoke permissions to admin users
        # https://aws.amazon.com/blogs/compute/secure-api-access-with-amazon-cognito-federated-identities-amazon-cognito-user-pools-and-amazon-api-gateway/
        admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "execute-api:Invoke"
                ],
                resources=[
                    api.arn_for_execute_api()

                    # api.arn_for_execute_api(method='GET',path='/models'),
                    # api.arn_for_execute_api(method='GET',path='/cars'),
                    # api.arn_for_execute_api(method='POST',path='/cars/upload'),
                    # api.arn_for_execute_api(method='POST',path='/cars/upload/status'),
                    # api.arn_for_execute_api(method='POST',path='/cars/delete_all_models'),
                    # api.arn_for_execute_api(method='POST',path='/cars/create_ssm_activation'),
                ]
            )
        )

        DefaultAdminUser(self, 'DefaultAdminUser', user_pool, 'esbjj@amazon.com')

        ## Outputs
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