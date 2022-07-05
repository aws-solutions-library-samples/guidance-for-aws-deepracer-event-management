from aws_cdk import (
    aws_cognito as cognito
)

from constructs import Construct

from aws_cdk.custom_resources import (
    AwsCustomResource,
    AwsCustomResourcePolicy,
    AwsSdkCall,
    PhysicalResourceId,
)


class DefaultAdminUser(Construct):
    """Creates a default admin user in the cognito user pool
    Arguments:
        :param user_pool_id: user pool to create the admin user in
        :param username: username of the user to create
        :param email: email of the user to create
        :param log_retention: The number of days log events of the Lambda function implementing this custom resource are kept in CloudWatch Logs. 
                              Default: logs.RetentionDays.INFINITE
    """

    def __init__(self, scope: Construct, id: str, user_pool: cognito.UserPool, email:str) -> None:
        super().__init__(scope, id)

        cr = AwsCustomResource(self,'AdminUserCustomResource',
            policy=AwsCustomResourcePolicy.from_sdk_calls(
                resources=AwsCustomResourcePolicy.ANY_RESOURCE
            ),
            #log_retention=logs.RetentionDays.INFINITE,
            on_create=self.create(user_pool.user_pool_id, email),
            on_update=self.create(user_pool.user_pool_id, email),
            on_delete=self.delete(user_pool.user_pool_id),
            resource_type='Custom::AdminUserCustomResource'
        )

     #   username = cr.get_response_field('User.Username')
     #   return username


    def create(self, user_pool_id: str, email: str):
        username = 'admin'
        create_user_params = {
            "UserPoolId": user_pool_id,
            "Username": username,
            "UserAttributes": [
                {
                    'Name': 'email_verified',
                    'Value': 'True'
                },
                {
                    'Name': 'email',
                    'Value': 'esbjj@amazon.com'
                },
            ],
            "MessageAction": "SUPPRESS",
            "TemporaryPassword": "DremAdmin0!"
        }

        result_create_user = AwsSdkCall(
            action='adminCreateUser',
            service='CognitoIdentityServiceProvider',
            parameters=create_user_params,
            physical_resource_id=PhysicalResourceId.of(f'{user_pool_id}:admin') # TODO how to get id/username from the response?
        )

        assign_user_to_group_params = {
            "UserPoolId": user_pool_id,
            "Username": username,
            "GroupName": 'admin' #TODO add as input to Custom resource
        }

        AwsSdkCall(
            action='adminAddUserToGroup',
            service='CognitoIdentityServiceProvider',
            parameters=assign_user_to_group_params,
            physical_resource_id=PhysicalResourceId.of(f'{user_pool_id}:admin:group') # TODO how to get id/username from the response?
        )

        return result_create_user


    def delete(self, user_pool_id):
        delete_params = {
            "UserPoolId": user_pool_id,
            "Username": 'admin'
        }

        return AwsSdkCall(
            action='adminDeleteUser',
            service='CognitoIdentityServiceProvider',
            parameters=delete_params,
            physical_resource_id=PhysicalResourceId.of(f'{user_pool_id}:admin') # TODO how to get the id/username from the response?
        )
