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


class CarManager(Construct):

    def __init__(self, scope: Construct, id: str, api: appsync.IGraphqlApi, roles_to_grant_invoke_access: list[iam.IRole], **kwargs):
        super().__init__(scope, id, **kwargs)

        stack = Stack.of(self)

        lambda_architecture = awslambda.Architecture.ARM_64
        lambda_runtime = awslambda.Runtime.PYTHON_3_9
        lambda_bundling_image = DockerImage.from_registry('public.ecr.aws/sam/build-python3.9:latest-arm64')
        powertools_layer = lambda_python.PythonLayerVersion.from_layer_version_arn(self, "powertools",'arn:aws:lambda:eu-west-1:017000801446:layer:AWSLambdaPowertoolsPython:3')

        ## car_activation method
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
            layers=[powertools_layer],
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

        ## cars_function_handler
        cars_function_handler = lambda_python.PythonFunction(self, "cars_function_handler",
            entry="backend/lambdas/cars_function/",
            description="Cars Function",
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
            layers=[powertools_layer],
        )

        cars_function_handler.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:DescribeInstanceInformation",
                    "ssm:ListTagsForResource"
                ],
                resources=["*"],
            )
        )

        # Define the data source for the API
        cars_online_data_source = api.add_lambda_data_source('cars_online_data_source', cars_function_handler)

        # Define API Schema (returned data)
        car_online_object_type = appsync.ObjectType("carOnline",
            definition={
                "InstanceId": appsync.GraphqlType.string(),
                "PingStatus": appsync.GraphqlType.string(),
                "LastPingDateTime": appsync.GraphqlType.string(),
                "AgentVersion": appsync.GraphqlType.string(),
                "IsLatestVersion": appsync.GraphqlType.boolean(),
                "PlatformType": appsync.GraphqlType.string(),
                "PlatformName": appsync.GraphqlType.string(),
                "PlatformVersion": appsync.GraphqlType.string(),
                "ActivationId": appsync.GraphqlType.id(),
                "IamRole": appsync.GraphqlType.string(),
                "RegistrationDate": appsync.GraphqlType.string(),
                "ResourceType": appsync.GraphqlType.string(),
                "Name": appsync.GraphqlType.string(),
                "IPAddress": appsync.GraphqlType.string(),
                "ComputerName": appsync.GraphqlType.string(),
                #"SourceId": appsync.GraphqlType.string(),
                #"SourceType": appsync.GraphqlType.string(),
                "eventId": appsync.GraphqlType.id(),
                "eventName": appsync.GraphqlType.string()
            }
        )

        api.add_type(car_online_object_type)

        # Event methods (input data)
        api.add_query("carsOnline", appsync.ResolvableField(
            args={
                "online": appsync.GraphqlType.boolean(is_required=True),
            },
            return_type=car_online_object_type.attribute(is_list=True),
            data_source=cars_online_data_source
        ))


        ## All Methods...
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
                        f'{api.arn}/types/Query/fields/carsOnline',
                    ],
                )
            )
