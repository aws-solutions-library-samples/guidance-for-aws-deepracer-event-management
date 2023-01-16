from aws_cdk import Duration
from aws_cdk import aws_apigateway as apig
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as awslambda
from aws_cdk import aws_lambda_python_alpha as lambda_python
from constructs import Construct

from backend.constructs.common import BaseStack


class GroupManager(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        base_stack: BaseStack,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        # GET groups users Function
        get_groups_group_function = lambda_python.PythonFunction(
            self,
            "get_groups_group_function",
            entry="backend/lambdas/get_groups_group_function/",
            description="Get the group details from cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "user_pool_id": base_stack.idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "get_groups_group",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )
        get_groups_group_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:ListUsersInGroup",
                ],
                resources=[base_stack.idp.user_pool.user_pool_arn],
            )
        )

        # Post groups group user Function
        post_groups_group_user_function = lambda_python.PythonFunction(
            self,
            "post_groups_group_user_function",
            entry="backend/lambdas/post_groups_group_user_function/",
            description="Add a user to a group in cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "user_pool_id": base_stack.idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "post_groups_group_user",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )
        post_groups_group_user_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:AdminAddUserToGroup",
                ],
                resources=[base_stack.idp.user_pool.user_pool_arn],
            )
        )

        # Delete groups group user Function
        delete_groups_group_user_function = lambda_python.PythonFunction(
            self,
            "delete_groups_group_user_function",
            entry="backend/lambdas/delete_groups_group_user_function/",
            description="Remove a user from a group in cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "user_pool_id": base_stack.idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "delete_groups_group_user",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )
        delete_groups_group_user_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:AdminRemoveUserFromGroup",
                ],
                resources=[base_stack.idp.user_pool.user_pool_arn],
            )
        )

        # Get groups Function
        get_groups_function = lambda_python.PythonFunction(
            self,
            "get_groups_function",
            entry="backend/lambdas/get_groups_function/",
            description="List the groups in cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "user_pool_id": base_stack.idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "get_groups",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )
        get_groups_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:ListGroups",
                ],
                resources=[base_stack.idp.user_pool.user_pool_arn],
            )
        )

        # Put groups group Function
        put_groups_group_function = lambda_python.PythonFunction(
            self,
            "put_groups_group_function",
            entry="backend/lambdas/put_groups_group_function/",
            description="Add a group to cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "user_pool_id": base_stack.idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "put_groups_group",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )
        put_groups_group_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:CreateGroup",
                ],
                resources=[base_stack.idp.user_pool.user_pool_arn],
            )
        )

        # Delete groups group Function
        delete_groups_group_function = lambda_python.PythonFunction(
            self,
            "delete_groups_group_function",
            entry="backend/lambdas/delete_groups_group_function/",
            description="Delete a group from cognito",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "user_pool_id": base_stack.idp.user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "delete_groups_group",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )
        delete_groups_group_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:DeleteGroup",
                ],
                resources=[base_stack.idp.user_pool.user_pool_arn],
            )
        )

        # API RESOURCES
        username_groupname_model = base_stack.rest_api.rest_api.add_model(
            "UsernameGroupnameModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "username": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                    "groupname": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                },
            ),
        )

        # GET /admin/groups
        api_admin_groups = base_stack.rest_api.admin_api_node.add_resource("groups")
        api_admin_groups.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=get_groups_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # PUT /admin/groups
        api_admin_groups.add_method(
            http_method="PUT",
            integration=apig.LambdaIntegration(handler=put_groups_group_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # /admin/groups/{groupname}
        group = api_admin_groups.add_resource("{groupname}")

        # GET /admin/groups/{groupname}
        group.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=get_groups_group_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # DELETE /admin/groups/{groupname}
        group.add_method(
            http_method="DELETE",
            integration=apig.LambdaIntegration(handler=delete_groups_group_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        # POST /admin/groups/{groupname}
        group.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=post_groups_group_user_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={"application/json": username_groupname_model},
            request_validator=base_stack.rest_api._body_validator,
        )

        # /admin/groups/{groupname}/{username}
        group_user = group.add_resource("{username}")

        # DELETE /admin/groups/{groupname}/{username}
        group_user.add_method(
            http_method="DELETE",
            integration=apig.LambdaIntegration(
                handler=delete_groups_group_user_function
            ),
            authorization_type=apig.AuthorizationType.IAM,
        )
