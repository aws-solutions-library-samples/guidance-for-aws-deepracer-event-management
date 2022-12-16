"""Based on this javascript Github project https://github.com/awesome-cdk/cdk-userpool-user """

from aws_cdk.aws_cognito import (
    CfnUserPoolUser,
    CfnUserPoolUserToGroupAttachment,
    IUserPool,
)
from aws_cdk.custom_resources import (
    AwsCustomResource,
    AwsCustomResourcePolicy,
    AwsSdkCall,
    PhysicalResourceId,
)
from constructs import Construct


class UserPoolUser(Construct):
    """
    Creates a user in the provided Cognito User pool
    """

    def __init__(
        self,
        scope: Construct,
        id: str,
        username: str,
        email: str,
        user_pool: IUserPool,
        group_name: str,
    ) -> None:
        super().__init__(scope, id)

        admin_user = CfnUserPoolUser(
            self,
            "admin_user",
            username=username,
            user_pool_id=user_pool.user_pool_id,
            desired_delivery_mediums=["EMAIL"],
            user_attributes=[
                CfnUserPoolUser.AttributeTypeProperty(name="email", value=email)
            ],
        )

        # If a Group Name is provided, also add the user to this Cognito UserPool Group
        if group_name:
            user_to_group_attachment = CfnUserPoolUserToGroupAttachment(
                self,
                "user_to_group_attachment",
                user_pool_id=user_pool.user_pool_id,
                group_name=group_name,
                username=admin_user.username,
            )
            user_to_group_attachment.node.add_dependency(admin_user)
            user_to_group_attachment.node.add_dependency(user_pool)
