'''Based on this javascript Github project https://github.com/awesome-cdk/cdk-userpool-user '''

from aws_cdk.custom_resources import (
    AwsCustomResource,
    AwsCustomResourcePolicy,
    AwsSdkCall,
    PhysicalResourceId,
)
from aws_cdk.aws_cognito import (
    CfnUserPoolUser,
    CfnUserPoolUserToGroupAttachment,
    IUserPool
)

from constructs import Construct


class UserPoolUser(Construct):
    '''
        Creates a user in the provided Cognito User pool
    '''

    def __init__(self, scope: Construct, id: str, username: str, password: str, user_pool: IUserPool, group_name: str) -> None:
        super().__init__(scope, id)

        # Create the user inside the Cognito user pool using Lambda backed AWS Custom resource
        admin_create_user = AwsCustomResource(self, 'AwsCustomResource-CreateUser',
            policy=AwsCustomResourcePolicy.from_sdk_calls(resources=['*']), #TODO make least priviliage, look here for example https://github.com/aws-samples/aws-cdk-examples/blob/master/python/custom-resource/my_custom_resource.py
            on_create=AwsSdkCall(
                service='CognitoIdentityServiceProvider',
                action='adminCreateUser',
                parameters = {
                    'UserPoolId': user_pool.user_pool_id,
                    'Username': username,
                    'MessageAction': 'SUPPRESS',
                    'TemporaryPassword': password,
                },
                physical_resource_id=PhysicalResourceId.of(f'AwsCustomResource-CreateUser-{username}'),
             ),
            on_delete=AwsSdkCall(
                service="CognitoIdentityServiceProvider",
                action="adminDeleteUser",
                parameters= {
                        'UserPoolId': user_pool.user_pool_id,
                        'Username': username,
                    }
            ),
            install_latest_aws_sdk=True
        )

        # Force the password for the user, because by default when new users are created
        # they are in FORCE_PASSWORD_CHANGE status. The newly created user has no way to change it though
        admin_set_user_password =  AwsCustomResource(self, 'AwsCustomResource-ForcePassword',
            policy=AwsCustomResourcePolicy.from_sdk_calls(resources=['*']), # TODO make least priviliage, look here for example https://github.com/aws-samples/aws-cdk-examples/blob/master/python/custom-resource/my_custom_resource.py
            on_create=AwsSdkCall(
                service= 'CognitoIdentityServiceProvider',
                action= 'adminSetUserPassword',
                parameters= {
                    'UserPoolId': user_pool.user_pool_id,
                    'Username': username,
                    'Password': password,
                    'Permanent': True,
                },
                physical_resource_id= PhysicalResourceId.of(f'AwsCustomResource-ForcePassword-{username}'),
            ),
            install_latest_aws_sdk=True
        )
        admin_set_user_password.node.add_dependency(admin_create_user)

        # If a Group Name is provided, also add the user to this Cognito UserPool Group
        if group_name:
            user_to_admins_group_attachment = CfnUserPoolUserToGroupAttachment(self, 'AttachAdminToAdminsGroup',
                user_pool_id=user_pool.user_pool_id,
                group_name=group_name,
                username=username,
            )
            user_to_admins_group_attachment.node.add_dependency(admin_create_user)
            user_to_admins_group_attachment.node.add_dependency(admin_set_user_password)
            user_to_admins_group_attachment.node.add_dependency(user_pool)

        admin_user = CfnUserPoolUser(self, 'admin_user',
            username='test',
            user_pool_id=user_pool.user_pool_id,
            desired_delivery_mediums=['EMAIL'],
            user_attributes=[CfnUserPoolUser.AttributeTypeProperty(
                name='email',
                value='askwith@amazon.co.uk'
            )],
        )

        # If a Group Name is provided, also add the user to this Cognito UserPool Group
        if group_name:
            user_to_group_attachment = CfnUserPoolUserToGroupAttachment(self, 'user_to_group_attachment',
                user_pool_id=user_pool.user_pool_id,
                group_name=group_name,
                username=admin_user.username,
            )
            # user_to_group_attachment.node.add_dependency(admin_create_user)
            # user_to_group_attachment.node.add_dependency(admin_set_user_password)
            # user_to_group_attachment.node.add_dependency(user_pool)


