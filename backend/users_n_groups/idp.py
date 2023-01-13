from aws_cdk import CfnOutput, Duration, RemovalPolicy, Stack
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_iam as iam
from cdk_nag import NagSuppressions
from constructs import Construct

from backend.users_n_groups.user_pool_user import UserPoolUser


class Idp(Construct):
    @property
    def user_pool(self) -> cognito.IUserPool:
        return self._user_pool

    @property
    def identity_pool(self) -> cognito.CfnIdentityPool:
        return self._identity_pool

    @property
    def admin_user_role(self) -> iam.IRole:
        return self._admin_user_role

    @property
    def operator_user_role(self) -> iam.IRole:
        return self._operator_user_role

    @property
    def unauthenticated_user_role(self) -> iam.IRole:
        return self._unauth_user_role

    def __init__(
        self,
        scope: Construct,
        id: str,
        distribution: cloudfront.IDistribution,
        default_admin_email: str,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        stack = Stack.of(self)

        self._user_pool = cognito.UserPool(
            self,
            "UserPool",
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
                temp_password_validity=Duration.days(2),
            ),
            user_invitation=cognito.UserInvitationConfig(
                email_subject="Invite to join DREM",
                email_body=(
                    "Hello {username}, you have been invited to join DREM. \nYour"
                    " temporary password is \n\n{####}\n\n"
                )
                + "https://"
                + distribution.distribution_domain_name,
                sms_message=(
                    "Hello {username}, your temporary password for DREM is {####}"
                ),
            ),
            user_verification=cognito.UserVerificationConfig(
                email_subject="Verify your email for DREM",
                email_body=(
                    "Thanks for signing up to DREM \n\nYour verification code is"
                    " \n{####}"
                ),
                email_style=cognito.VerificationEmailStyle.CODE,
                sms_message=(
                    "Thanks for signing up to DREM. Your verification code is {####}"
                ),
            ),
        )

        NagSuppressions.add_resource_suppressions(
            self._user_pool,
            suppressions=[
                {
                    "id": "AwsSolutions-COG2",
                    "reason": (
                        "users only sign up and us DREM for a short period of time, all"
                        " users are deleted after 10 days inactivity"
                    ),
                },
                {
                    "id": "AwsSolutions-COG3",
                    "reason": (
                        "users only sign up and us DREM for a short period of time, all"
                        " users are deleted after 10 days inactivity"
                    ),
                },
            ],
        )

        # Cognito Client
        user_pool_client_web = cognito.UserPoolClient(
            self,
            "UserPoolClientWeb",
            user_pool=self._user_pool,
            prevent_user_existence_errors=True,
        )

        cfn_user_pool_client_web = user_pool_client_web.node.default_child
        cfn_user_pool_client_web.callback_ur_ls = [
            "https://" + distribution.distribution_domain_name,
            "http://localhost:3000",
        ]
        cfn_user_pool_client_web.logout_ur_ls = [
            "https://" + distribution.distribution_domain_name,
            "http://localhost:3000",
        ]

        # Cognito Identity Pool
        self._identity_pool = cognito.CfnIdentityPool(
            self,
            "IdentityPool",
            allow_unauthenticated_identities=False,
            cognito_identity_providers=[
                cognito.CfnIdentityPool.CognitoIdentityProviderProperty(
                    client_id=user_pool_client_web.user_pool_client_id,
                    provider_name=self._user_pool.user_pool_provider_name,
                )
            ],
        )

        # Cognito Identity Pool Authenitcated Role
        id_pool_auth_user_role = iam.Role(
            self,
            "CognitoDefaultAuthenticatedRole",
            assumed_by=iam.FederatedPrincipal(
                federated="cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self._identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity",
            ),
        )

        # #Cognito Identity Pool Unauthenitcated Role
        # needed for accessing stream overlays
        self._unauth_user_role = iam.Role(
            self,
            "CognitoDefaultUnauthenticatedRole",
            assumed_by=iam.FederatedPrincipal(
                federated="cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self._identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "unauthenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity",
            ),
        )

        cognito.CfnIdentityPoolRoleAttachment(
            self,
            "IdentityPoolRoleAttachment",
            identity_pool_id=self._identity_pool.ref,
            roles={
                "authenticated": id_pool_auth_user_role.role_arn,
                "unauthenticated": self._unauth_user_role.role_arn,
            },
            role_mappings={
                "role_mapping": cognito.CfnIdentityPoolRoleAttachment.RoleMappingProperty(  # noqa: E501
                    type="Token",
                    identity_provider="{}:{}".format(
                        self._user_pool.user_pool_provider_name,
                        user_pool_client_web.user_pool_client_id,
                    ),
                    ambiguous_role_resolution="AuthenticatedRole",
                )
            },
        )

        # Admin Users Group Role
        self._admin_user_role = iam.Role(
            self,
            "AdminUserRole",
            assumed_by=iam.FederatedPrincipal(
                federated="cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self._identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity",
            ),
        )

        # Operator Users Group Role
        self._operator_user_role = iam.Role(
            self,
            "OperatorUserRole",
            assumed_by=iam.FederatedPrincipal(
                federated="cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self._identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity",
            ),
        )

        # Cognito User Group (Operator)
        cognito.CfnUserPoolGroup(
            self,
            "OperatorGroup",
            user_pool_id=self._user_pool.user_pool_id,
            description="Operator user group",
            group_name="operator",
            role_arn=self._operator_user_role.role_arn,
            precedence=1,
        )

        # Cognito User Group (Admin)
        admin_user_pool_group = cognito.CfnUserPoolGroup(
            self,
            "AdminGroup",
            user_pool_id=self._user_pool.user_pool_id,
            description="Admin user group",
            group_name="admin",
            role_arn=self._admin_user_role.role_arn,
            precedence=1,
        )

        # Add a default Admin user to the system
        default_admin_user_name = "admin"

        UserPoolUser(
            self,
            "DefaultAdminUser",
            username=default_admin_user_name,
            email=default_admin_email,
            user_pool=self._user_pool,
            group_name=admin_user_pool_group.ref,
        )

        # Outputs
        self.userPoolWebClientId = CfnOutput(
            self, "userPoolWebClientId", value=user_pool_client_web.user_pool_client_id
        )

        self.identityPoolId = CfnOutput(
            self, "identityPoolId", value=self._identity_pool.ref
        )

        self.userPoolId = CfnOutput(
            self, "userPoolId", value=self._user_pool.user_pool_id
        )

        CfnOutput(self, "DefaultAdminUserUsername", value=default_admin_user_name)

        CfnOutput(self, "DefaultAdminEmail", value=default_admin_email)
