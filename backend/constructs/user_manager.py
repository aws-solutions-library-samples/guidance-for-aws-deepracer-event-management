from aws_cdk import DockerImage, Duration
from aws_cdk import aws_apigateway as apig
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as awslambda
from aws_cdk import aws_lambda_python_alpha as lambda_python
from constructs import Construct

from backend.constructs.common import BaseStack


class UserManager(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        base_stack: BaseStack,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        # List users Function
        get_users_function = lambda_python.PythonFunction(
            self,
            "get_users_function",
            entry="backend/lambdas/get_users_function/",
            description="List the users in cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "user_pool_id": base_stack.idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "get_users",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )
        get_users_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:ListUsers",
                ],
                resources=[base_stack.idp.user_pool.user_pool_arn],
            )
        )

        # API RESOURCES
        api_users = base_stack.rest_api.rest_api.root.add_resource("users")
        api_users.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=get_users_function),
            authorization_type=apig.AuthorizationType.IAM,
        )
