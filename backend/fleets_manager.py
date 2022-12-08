from os import path, getcwd

from aws_cdk import (
    Stack,
    Duration,
    DockerImage,
    aws_appsync_alpha as appsync,
    aws_dynamodb as dynamodb,
    aws_lambda_python_alpha as lambda_python,
    aws_lambda as awslambda,
    aws_cognito as cognito,
    aws_iam as iam,
)

from constructs import Construct


class FleetsManager(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        api: appsync.IGraphqlApi,
        user_pool: cognito.IUserPool,
        roles_to_grant_invoke_access: list[iam.IRole],
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        stack = Stack.of(self)

        fleets_table = dynamodb.Table(
            self,
            "FleetsTable",
            partition_key=dynamodb.Attribute(
                name="fleetId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption=dynamodb.TableEncryption.AWS_MANAGED,
        )

        lambda_architecture = awslambda.Architecture.ARM_64
        lambda_runtime = awslambda.Runtime.PYTHON_3_9
        lambda_bundling_image = DockerImage.from_registry(
            "public.ecr.aws/sam/build-python3.9:latest-arm64"
        )

        fleets_handler = lambda_python.PythonFunction(
            self,
            "fleetsFunction",
            entry="backend/lambdas/fleets_function/",
            description="Fleets Resolver",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            # layers=[helper_functions_layer, powertools_layer]
            layers=[
                lambda_python.PythonLayerVersion.from_layer_version_arn(
                    self,
                    "powertools",
                    "arn:aws:lambda:eu-west-1:017000801446:layer:AWSLambdaPowertoolsPython:3",
                )
            ],
            environment={
                "DDB_TABLE": fleets_table.table_name,
                "user_pool_id": user_pool.user_pool_id,
            },
        )

        fleets_table.grant_read_write_data(fleets_handler)

        # Define the data source for the API
        fleets_data_source = api.add_lambda_data_source(
            "FleetsDataSource", fleets_handler
        )

        none_data_source = api.add_none_data_source("fleets_none")
        # Define API Schema

        fleets_object_Type = appsync.ObjectType(
            "Fleet",
            definition={
                "fleetName": appsync.GraphqlType.string(),
                "fleetId": appsync.GraphqlType.id(),
                "createdAt": appsync.GraphqlType.aws_date_time(),
            },
        )

        api.add_type(fleets_object_Type)

        # Fleet methods
        api.add_query(
            "getAllFleets",
            appsync.ResolvableField(
                return_type=fleets_object_Type.attribute(is_list=True),
                data_source=fleets_data_source,
            ),
        )
        api.add_mutation(
            "addFleet",
            appsync.ResolvableField(
                args={
                    "fleetName": appsync.GraphqlType.string(is_required=True),
                },
                return_type=fleets_object_Type.attribute(),
                data_source=fleets_data_source,
            ),
        )
        api.add_subscription(
            "addedFleet",
            appsync.ResolvableField(
                return_type=fleets_object_Type.attribute(),
                data_source=none_data_source,
                request_mapping_template=appsync.MappingTemplate.from_string(
                    """{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }"""
                ),
                response_mapping_template=appsync.MappingTemplate.from_string(
                    """$util.toJson($context.result)"""
                ),
                directives=[appsync.Directive.subscribe("addFleet")],
            ),
        )

        api.add_mutation(
            "deleteFleet",
            appsync.ResolvableField(
                args={"fleetId": appsync.GraphqlType.string(is_required=True)},
                return_type=fleets_object_Type.attribute(),
                data_source=fleets_data_source,
            ),
        )
        api.add_subscription(
            "deletedFleet",
            appsync.ResolvableField(
                return_type=fleets_object_Type.attribute(),
                data_source=none_data_source,
                request_mapping_template=appsync.MappingTemplate.from_string(
                    """{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }"""
                ),
                response_mapping_template=appsync.MappingTemplate.from_string(
                    """$util.toJson($context.result)"""
                ),
                directives=[appsync.Directive.subscribe("deleteFleet")],
            ),
        )

        api.add_mutation(
            "updateFleet",
            appsync.ResolvableField(
                args={
                    "fleetId": appsync.GraphqlType.string(is_required=True),
                    "fleetName": appsync.GraphqlType.string(),
                },
                return_type=fleets_object_Type.attribute(),
                data_source=fleets_data_source,
            ),
        )
        api.add_subscription(
            "updatedFleet",
            appsync.ResolvableField(
                return_type=fleets_object_Type.attribute(),
                data_source=none_data_source,
                request_mapping_template=appsync.MappingTemplate.from_string(
                    """{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }"""
                ),
                response_mapping_template=appsync.MappingTemplate.from_string(
                    """$util.toJson($context.result)"""
                ),
                directives=[appsync.Directive.subscribe("updateFleet")],
            ),
        )

        # Grant access so API methods can be invoked
        for role in roles_to_grant_invoke_access:
            role.add_to_policy(
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=["appsync:GraphQL"],
                    resources=[
                        f"{api.arn}/types/Query/fields/getAllFleets",
                        f"{api.arn}/types/Mutation/fields/addFleet",
                        f"{api.arn}/types/Subscription/fields/addedFleet",
                        f"{api.arn}/types/Mutation/fields/deleteFleet",
                        f"{api.arn}/types/Subscription/fields/deletedFleet",
                        f"{api.arn}/types/Mutation/fields/updateFleet",
                        f"{api.arn}/types/Subscription/fields/addedFleet",
                        f"{api.arn}/types/Subscription/fields/deletedFleet",
                        f"{api.arn}/types/Subscription/fields/updatedFleet",
                    ],
                )
            )
