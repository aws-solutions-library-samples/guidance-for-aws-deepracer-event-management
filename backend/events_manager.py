from os import (
    path,
    getcwd
)

from aws_cdk import (
    Stack,
    Duration,
    DockerImage,
    aws_appsync_alpha as appsync,
    aws_dynamodb as dynamodb,
    aws_lambda_python_alpha as lambda_python,
    aws_lambda as awslambda,
    aws_cognito as cognito,
    aws_iam as iam
)

from constructs import Construct


class EventsManager(Construct):

    def __init__(self, scope: Construct, id: str, api: appsync.IGraphqlApi, user_pool: cognito.IUserPool, roles_to_grant_invoke_access: list[iam.IRole], **kwargs):
        super().__init__(scope, id, **kwargs)

        stack = Stack.of(self)

        events_table = dynamodb.Table(self, "EventsTable",
                                      partition_key=dynamodb.Attribute(
                                          name="eventId", type=dynamodb.AttributeType.STRING),
                                      billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
                                      encryption=dynamodb.TableEncryption.AWS_MANAGED
                                      )

        lambda_architecture = awslambda.Architecture.ARM_64
        lambda_runtime = awslambda.Runtime.PYTHON_3_9
        lambda_bundling_image = DockerImage.from_registry(
            'public.ecr.aws/sam/build-python3.9:latest-arm64')

        events_handler = lambda_python.PythonFunction(self, "eventsFunction",
                                                      entry="backend/lambdas/events_function/",
                                                      description="Events Resolver",
                                                      index="index.py",
                                                      handler="lambda_handler",
                                                      timeout=Duration.minutes(
                                                          1),
                                                      runtime=lambda_runtime,
                                                      tracing=awslambda.Tracing.ACTIVE,
                                                      memory_size=128,
                                                      architecture=lambda_architecture,
                                                      bundling=lambda_python.BundlingOptions(
                                                          image=lambda_bundling_image
                                                      ),
                                                      # layers=[helper_functions_layer, powertools_layer]
                                                      layers=[lambda_python.PythonLayerVersion.from_layer_version_arn(self, "powertools",
                                                                                                                      'arn:aws:lambda:eu-west-1:017000801446:layer:AWSLambdaPowertoolsPython:3')
                                                              ],
                                                      environment={
                                                          'DDB_TABLE': events_table.table_name,
                                                          "user_pool_id": user_pool.user_pool_id
                                                      })

        events_table.grant_read_write_data(events_handler)

        # Define the data source for the API
        events_data_source = api.add_lambda_data_source(
            'EventsDataSource', events_handler)

        # Define API Schema
        track_object_type = appsync.ObjectType("Track",
                                               definition={
                                                   "trackName": appsync.GraphqlType.string(),
                                                   "trackId": appsync.GraphqlType.id(),
                                                   "trackTag": appsync.GraphqlType.string()
                                               })

        track_input_type = appsync.InputType('TrackInput',
                                             definition={
                                                 "trackName": appsync.GraphqlType.string(),
                                                 "trackTag": appsync.GraphqlType.string()
                                             })

        events_object_Type = appsync.ObjectType("Event",
                                                definition={
                                                    "eventName": appsync.GraphqlType.string(),
                                                    "eventId": appsync.GraphqlType.id(),
                                                    "createdAt": appsync.GraphqlType.aws_date_time(),
                                                    "tracks": track_object_type.attribute(is_list=True)
                                                })

        api.add_type(track_object_type)
        api.add_type(track_input_type)
        api.add_type(events_object_Type)

        # Event methods
        api.add_query("getAllEvents", appsync.ResolvableField(
            return_type=events_object_Type.attribute(is_list=True),
            data_source=events_data_source
        ))
        api.add_mutation("addEvent", appsync.ResolvableField(
            args={
                'eventName': appsync.GraphqlType.string(is_required=True),
                'tracks': track_input_type.attribute(is_list=True)
            },
            return_type=events_object_Type.attribute(),
            data_source=events_data_source
        ))
        api.add_subscription('addedEvent', appsync.ResolvableField(
            return_type=events_object_Type.attribute(),
            directives= [appsync.Directive.subscribe('addEvent')],
            data_source= api.add_none_data_source('none')
        ))

        api.add_mutation("deleteEvent", appsync.ResolvableField(
            args={'eventId': appsync.GraphqlType.string(is_required=True)},
            return_type=events_object_Type.attribute(),
            data_source=events_data_source
        ))
        api.add_subscription('deletedEvent', appsync.ResolvableField(
            return_type=events_object_Type.attribute(),
            directives= [appsync.Directive.subscribe('deleteEvent')],
            data_source= api.add_none_data_source('none')
        ))

        api.add_mutation("updateEvent", appsync.ResolvableField(
            args={
                'eventId': appsync.GraphqlType.string(is_required=True),
                'eventName': appsync.GraphqlType.string(),
                'tracks': track_input_type.attribute(is_list=True)
            },
            return_type=events_object_Type.attribute(),
            data_source=events_data_source
        ))
        api.add_subscription('updatedEvent', appsync.ResolvableField(
            return_type=events_object_Type.attribute(),
            directives= [appsync.Directive.subscribe('updateEvent')],
            data_source= api.add_none_data_source('none')
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
                        f'{api.arn}/types/Query/fields/getAllEvents',
                        f'{api.arn}/types/Mutation/fields/addEvent',
                        f'{api.arn}/types/Subscription/fields/addedEvent',

                        f'{api.arn}/types/Mutation/fields/deleteEvent',
                        f'{api.arn}/types/Subscription/fields/deletedEvent',

                        f'{api.arn}/types/Mutation/fields/updateEvent',
                        f'{api.arn}/types/Subscription/fields/updatedEvent',
                    ],
                )
            )
