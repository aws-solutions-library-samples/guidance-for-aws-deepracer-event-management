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

        AwsCustomResource(self,'AdminUserCustomResource',
            policy=AwsCustomResourcePolicy.from_sdk_calls(
                resources=AwsCustomResourcePolicy.ANY_RESOURCE
            ),
            #log_retention=logs.RetentionDays.INFINITE,
            on_create=self.create(user_pool.user_pool_id, email),
            on_update=self.create(user_pool.user_pool_id, email),
            on_delete=self.delete(user_pool.user_pool_id),
            resource_type='Custom::AdminUserCustomResource'
        )


    def create(self, user_pool_id: str, email: str):
        create_params = {
            "UserPoolId": user_pool_id,
            "Username": 'admin',
            "UserAttributes": [
                {
                    'Name': 'email_verified',
                    'Value': 'True'
                },
                {
                    'Name': 'email',
                    'Value': email
                },
            ],
            "TemporaryPassword": "DremAdmin0!"
        }

        return AwsSdkCall(
            action='adminCreateUser',
            service='CognitoIdentityServiceProvider',
            parameters=create_params,
            physical_resource_id=PhysicalResourceId.of('myAutomationExecution')
        )


    def delete(self, user_pool_id):
        delete_params = {
            "UserPoolId": user_pool_id,
            "Username": 'admin'
        }

        return AwsSdkCall(
            action='adminDeleteUser',
            service='CognitoIdentityServiceProvider',
            parameters=delete_params,
            physical_resource_id=PhysicalResourceId.of('myAutomationExecution')
        )
