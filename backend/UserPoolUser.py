from aws_cdk.custom_resources import (
    AwsCustomResource,
    AwsCustomResourcePolicy,
    AwsSdkCall,
    PhysicalResourceId,
)
from aws_cdk.aws_cognito import (
    CfnUserPoolUserToGroupAttachment,
    IUserPool
)

from constructs import Construct


class UserPoolUser(Construct):
    """Creates a default admin user in the cognito user pool
    Arguments:
        :param user_pool_id: user pool to create the admin user in
        :param username: username of the user to create
        :param email: email of the user to create
        :param log_retention: The number of days log events of the Lambda function implementing 
            this custom resource are kept in CloudWatch Logs. Default: logs.RetentionDays.INFINITE
    """

    def __init__(self, scope: Construct, user_pool: IUserPool, username: str, password: str, group_name:str=None) -> None:
        super().__init__(scope, id)

        #Create the user inside the Cognito user pool using Lambda backed AWS Custom resource
        admin_create_user = AwsCustomResource(self, 'AwsCustomResource-CreateUser', 
            policy=AwsCustomResourcePolicy.from_sdk_calls(resources=['*']), # TODO make least priviliage, look here for example https://github.com/aws-samples/aws-cdk-examples/blob/master/python/custom-resource/my_custom_resource.py
            on_create=AwsSdkCall(
                service='CognitoIdentityServiceProvider',
                action='adminCreateUser',
                parameters = {
                    'UserPoolId': user_pool.userPoolId,
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
                        'UserPoolId': user_pool.userPoolId,
                        'Username': username,
                    }
            ),
            install_latest_aws_sdk=True
        )

        #Force the password for the user, because by default when new users are created
        #they are in FORCE_PASSWORD_CHANGE status. The newly created user has no way to change it though
        admin_set_user_password =  AwsCustomResource(self, 'AwsCustomResource-ForcePassword', 
            policy=AwsCustomResourcePolicy.from_sdk_calls(resources=['*']), # TODO make least priviliage, look here for example https://github.com/aws-samples/aws-cdk-examples/blob/master/python/custom-resource/my_custom_resource.py
            on_create=AwsSdkCall(
                service= 'CognitoIdentityServiceProvider',
                action= 'adminSetUserPassword',
                parameters= {
                    'UserPoolId': user_pool.userPoolId,
                    'Username': username,
                    'Password': password,
                    'Permanent': True,
                },
                physical_resource_id= PhysicalResourceId.of(f'AwsCustomResource-ForcePassword-{username}'),
            ),
            install_latest_aws_sdk=True
        )
        admin_set_user_password.node.addDependency(admin_create_user)

        # If a Group Name is provided, also add the user to this Cognito UserPool Group
        if (group_name):
            user_to_admins_group_attachment = CfnUserPoolUserToGroupAttachment(self, 'AttachAdminToAdminsGroup', 
                user_pool_id=user_pool.userPoolId,
                group_name=group_name,
                username=username,
            )
            user_to_admins_group_attachment.node.addDependency(admin_create_user);
            user_to_admins_group_attachment.node.addDependency(admin_set_user_password);
            user_to_admins_group_attachment.node.addDependency(user_pool);
    
     #   username = cr.get_response_field('User.Username')
     #   return username


    # def create(self, user_pool_id: str, username: str, password: str, group_name:str=None):
        
    #     create_user_params = {
    #         "UserPoolId": user_pool_id,
    #         "Username": username,
    #         "UserAttributes": [
    #             {
    #                 'Name': 'email_verified',
    #                 'Value': 'True'
    #             },
    #             {
    #                 'Name': 'email',
    #                 'Value': 'esbjj@amazon.com'
    #             },
    #         ],
    #         "MessageAction": "SUPPRESS",
    #         "TemporaryPassword": "DremAdmin0!"
    #     }

    #     result_create_user = AwsSdkCall(
    #         action='adminCreateUser',
    #         service='CognitoIdentityServiceProvider',
    #         parameters=create_user_params,
    #         physical_resource_id=PhysicalResourceId.of(f'{user_pool_id}:admin') # TODO how to get id/username from the response?
    #     )

    #     assign_user_to_group_params = {
    #         "UserPoolId": user_pool_id,
    #         "Username": username,
    #         "GroupName": 'admin' #TODO add as input to Custom resource
    #     }

    #     AwsSdkCall(
    #         action='adminAddUserToGroup',
    #         service='CognitoIdentityServiceProvider',
    #         parameters=assign_user_to_group_params,
    #         physical_resource_id=PhysicalResourceId.of(f'{user_pool_id}:group') # TODO how to get id/username from the response?
    #     )

    #     return result_create_user


    # def delete(self, user_pool_id):
    #     delete_params = {
    #         "UserPoolId": user_pool_id,
    #         "Username": 'admin'
    #     }

    #     return AwsSdkCall(
    #         action='adminDeleteUser',
    #         service='CognitoIdentityServiceProvider',
    #         parameters=delete_params,
    #         physical_resource_id=PhysicalResourceId.of(f'{user_pool_id}:admin') # TODO how to get the id/username from the response?
    #     )
