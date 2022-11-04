from aws_cdk import (
    Stack,
    Duration,
    DockerImage,
    aws_appsync_alpha as appsync,
    aws_lambda_python_alpha as lambda_python,
    aws_lambda as awslambda,
    aws_iam as iam
)

from constructs import Construct


class CarActivation(Construct):

    def __init__(self, scope: Construct, id: str, api: appsync.IGraphqlApi, roles_to_grant_invoke_access: list[iam.IRole], **kwargs):
        super().__init__(scope, id, **kwargs)

        stack = Stack.of(self)

        lambda_architecture = awslambda.Architecture.ARM_64
        lambda_runtime = awslambda.Runtime.PYTHON_3_9
        lambda_bundling_image = DockerImage.from_registry('public.ecr.aws/sam/build-python3.9:latest-arm64')

        car_activation_handler = lambda_python.PythonFunction(self, "car_activation_handler",
            entry="backend/lambdas/car_activation_function/",
            description="Car Activation",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            bundling=lambda_python.BundlingOptions(
                image=lambda_bundling_image
            ),
            layers=[lambda_python.PythonLayerVersion.from_layer_version_arn(self, "powertools",'arn:aws:lambda:eu-west-1:017000801446:layer:AWSLambdaPowertoolsPython:3')],
        )

        car_activation_handler.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "iam:PassRole",
                    "ssm:AddTagsToResource",
                    "ssm:CreateActivation"
                ],
                resources=["*"],
            )
        )

        # Define the data source for the API
        car_activation_data_source = api.add_lambda_data_source('car_activation_data_source', car_activation_handler)

        # Define API Schema
        car_activation_object_type = appsync.ObjectType("carActivation",
            definition={
                "region": appsync.GraphqlType.string(),
                "activationCode": appsync.GraphqlType.id(),
                "activationId": appsync.GraphqlType.string()
            }
        )

        api.add_type(car_activation_object_type)

        # Event methods
        api.add_mutation("carActivation", appsync.ResolvableField(
            args={
                "hostname": appsync.GraphqlType.string(is_required=True),
                "eventId": appsync.GraphqlType.id(is_required=True),
                'eventName': appsync.GraphqlType.string(is_required=True),
            },
            return_type=car_activation_object_type.attribute(),
            data_source=car_activation_data_source
        ))

        # Grant access so API methods can be invoked
        for role in roles_to_grant_invoke_access:
            role.add_to_policy(
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "appsync:GraphQL"
                    ],
                    resources=[
                        f'{api.arn}/types/Mutation/fields/carActivation',
                    ],
                )
            )
