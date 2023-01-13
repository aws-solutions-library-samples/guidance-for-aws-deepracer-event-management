from aws_cdk import DockerImage, Duration, RemovalPolicy
from aws_cdk import aws_appsync_alpha as appsync
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as awslambda
from aws_cdk import aws_lambda_python_alpha as lambda_python
from constructs import Construct


class EventsManager(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        api: appsync.IGraphqlApi,
        none_data_source: appsync.IGraphqlApi,
        user_pool: cognito.IUserPool,
        powertools_layer: lambda_python.PythonLayerVersion,
        powertools_log_level: str,
        lambda_architecture: awslambda.Architecture,
        lambda_runtime: awslambda.Runtime,
        lambda_bundling_image: DockerImage,
        roles_to_grant_invoke_access: list[iam.IRole],
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        events_table = dynamodb.Table(
            self,
            "EventsTable",
            partition_key=dynamodb.Attribute(
                name="eventId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption=dynamodb.TableEncryption.AWS_MANAGED,
            removal_policy=RemovalPolicy.DESTROY,
        )

        events_handler = lambda_python.PythonFunction(
            self,
            "eventsFunction",
            entry="backend/lambdas/events_function/",
            description="Events Resolver",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[powertools_layer],
            environment={
                "DDB_TABLE": events_table.table_name,
                "user_pool_id": user_pool.user_pool_id,
                "POWERTOOLS_SERVICE_NAME": "events_resolver",
                "LOG_LEVEL": powertools_log_level,
            },
        )

        events_table.grant_read_write_data(events_handler)

        # Define the data source for the API
        events_data_source = api.add_lambda_data_source(
            "EventsDataSource", events_handler
        )

        # Define API Schema

        events_object_Type = appsync.ObjectType(
            "Event",
            definition={
                "eventId": appsync.GraphqlType.id(),
                "createdAt": appsync.GraphqlType.aws_date_time(),
                "eventName": appsync.GraphqlType.string(),
                "eventDate": appsync.GraphqlType.aws_date(),
                "fleetId": appsync.GraphqlType.id(),
                "countryCode": appsync.GraphqlType.string(),
                "raceRankingMethod": appsync.GraphqlType.string(),
                "raceTimeInMin": appsync.GraphqlType.int(),
                "raceNumberOfResets": appsync.GraphqlType.int(),
                "raceLapsToFinish": appsync.GraphqlType.int(),
                "raceTrackType": appsync.GraphqlType.string(),
            },
        )

        api.add_type(events_object_Type)

        # Event methods
        api.add_query(
            "getAllEvents",
            appsync.ResolvableField(
                return_type=events_object_Type.attribute(is_list=True),
                data_source=events_data_source,
            ),
        )
        api.add_mutation(
            "addEvent",
            appsync.ResolvableField(
                args={
                    "eventName": appsync.GraphqlType.string(is_required=True),
                    "eventDate": appsync.GraphqlType.aws_date(),
                    "fleetId": appsync.GraphqlType.id(),
                    "countryCode": appsync.GraphqlType.string(),
                    "raceRankingMethod": appsync.GraphqlType.string(is_required=True),
                    "raceTimeInMin": appsync.GraphqlType.int(is_required=True),
                    "raceNumberOfResets": appsync.GraphqlType.int(is_required=True),
                    "raceLapsToFinish": appsync.GraphqlType.int(is_required=True),
                    "raceTrackType": appsync.GraphqlType.string(is_required=True),
                },
                return_type=events_object_Type.attribute(),
                data_source=events_data_source,
            ),
        )
        api.add_subscription(
            "onAddedEvent",
            appsync.ResolvableField(
                return_type=events_object_Type.attribute(),
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
                directives=[appsync.Directive.subscribe("addEvent")],
            ),
        )

        api.add_mutation(
            "deleteEvents",
            appsync.ResolvableField(
                args={"eventIds": appsync.GraphqlType.string(is_required_list=True)},
                return_type=events_object_Type.attribute(is_list=True),
                data_source=events_data_source,
            ),
        )
        api.add_subscription(
            "onDeletedEvents",
            appsync.ResolvableField(
                return_type=events_object_Type.attribute(is_list=True),
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
                directives=[appsync.Directive.subscribe("deleteEvents")],
            ),
        )

        api.add_mutation(
            "updateEvent",
            appsync.ResolvableField(
                args={
                    "eventId": appsync.GraphqlType.string(is_required=True),
                    "eventName": appsync.GraphqlType.string(),
                    "eventDate": appsync.GraphqlType.aws_date(),
                    "fleetId": appsync.GraphqlType.id(),
                    "countryCode": appsync.GraphqlType.string(),
                    "raceTrackType": appsync.GraphqlType.string(),
                    "raceRankingMethod": appsync.GraphqlType.string(),
                    "raceTimeInMin": appsync.GraphqlType.int(),
                    "raceNumberOfResets": appsync.GraphqlType.int(),
                    "raceLapsToFinish": appsync.GraphqlType.int(),
                },
                return_type=events_object_Type.attribute(),
                data_source=events_data_source,
            ),
        )
        api.add_subscription(
            "onUpdatedEvent",
            appsync.ResolvableField(
                return_type=events_object_Type.attribute(),
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
                directives=[appsync.Directive.subscribe("updateEvent")],
            ),
        )

        # Grant access so API methods can be invoked
        for role in roles_to_grant_invoke_access:
            role.add_to_policy(
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=["appsync:GraphQL"],
                    resources=[
                        f"{api.arn}/types/Query/fields/getAllEvents",
                        f"{api.arn}/types/Mutation/fields/addEvent",
                        f"{api.arn}/types/Subscription/fields/addedEvent",
                        f"{api.arn}/types/Mutation/fields/deleteEvent",
                        f"{api.arn}/types/Subscription/fields/deletedEvent",
                        f"{api.arn}/types/Mutation/fields/updateEvent",
                        f"{api.arn}/types/Subscription/fields/addedEvent",
                        f"{api.arn}/types/Subscription/fields/deletedEvent",
                        f"{api.arn}/types/Subscription/fields/updatedEvent",
                        # f'{api.arn}/types/Mutation/fields/addTrack',
                        # f'{api.arn}/types/Mutation/fields/deleteTrack',
                        # f'{api.arn}/types/Mutation/fields/updateTrack',
                    ],
                )
            )
