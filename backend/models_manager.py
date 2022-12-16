from aws_cdk import DockerImage, Duration
from aws_cdk import aws_appsync_alpha as appsync
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as awslambda
from aws_cdk import aws_lambda_event_sources as aws_lambda_event_sources
from aws_cdk import aws_lambda_python_alpha as lambda_python
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_sqs as sqs
from constructs import Construct


class ModelsManager(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        api: appsync.IGraphqlApi,
        none_data_source: appsync.IGraphqlApi,
        models_bucket: s3.Bucket,
        models_table: dynamodb.Table,
        helper_functions_layer: lambda_python.PythonLayerVersion,
        powertools_layer: lambda_python.PythonLayerVersion,
        powertools_log_level: str,
        lambda_architecture: awslambda.Architecture,
        lambda_runtime: awslambda.Runtime,
        lambda_bundling_image: DockerImage,
        roles_to_grant_invoke_access: list[iam.IRole],
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        models_md5_handler = lambda_python.PythonFunction(
            self,
            "modelsMD5Function",
            entry="backend/lambdas/models_md5/",
            description="Check MD5 on model files",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "DDB_TABLE": models_table.table_name,
                "MODELS_S3_BUCKET": models_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "md5_models",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )

        dead_letter_queue = sqs.Queue(self, "deadLetterQueue")
        models_md5_handler.add_event_source(
            aws_lambda_event_sources.DynamoEventSource(
                models_table,
                starting_position=awslambda.StartingPosition.TRIM_HORIZON,
                batch_size=1,
                bisect_batch_on_error=True,
                on_failure=aws_lambda_event_sources.SqsDlq(dead_letter_queue),
                retry_attempts=5,
                filters=[
                    awslambda.FilterCriteria.filter(
                        {"eventName": awslambda.FilterRule.is_equal("INSERT")}
                    )
                ],
            )
        )

        # Permissions for DynamoDB read / write
        models_table.grant_read_write_data(models_md5_handler)
        # Permissions for DynamoDB stream read
        models_table.grant_stream_read(models_md5_handler)

        # Permissions for s3 bucket read / write
        models_bucket.grant_read_write(models_md5_handler, "private/*")

        models_handler = lambda_python.PythonFunction(
            self,
            "modelsFunction",
            entry="backend/lambdas/models_function/",
            description="Models resolver",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=lambda_architecture,
            environment={
                "DDB_TABLE": models_table.table_name,
                "POWERTOOLS_SERVICE_NAME": "models resolver",
                "LOG_LEVEL": powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(image=lambda_bundling_image),
            layers=[helper_functions_layer, powertools_layer],
        )
        models_table.grant_read_write_data(models_handler)

        # Define the data source for the API
        models_data_source = api.add_lambda_data_source(
            "ModelsDataSource", models_handler
        )

        # Define API
        model_object_type = appsync.ObjectType(
            "Models",
            definition={
                "modelId": appsync.GraphqlType.id(),
                "modelKey": appsync.GraphqlType.string(),
                "racerName": appsync.GraphqlType.string(),
                "racerIdentityId": appsync.GraphqlType.string(),
                "modelFilename": appsync.GraphqlType.string(),
                "uploadedDateTime": appsync.GraphqlType.aws_date_time(),
                "md5DateTime": appsync.GraphqlType.aws_date_time(),
                "modelMD5": appsync.GraphqlType.string(),
                "modelMetadataMD5": appsync.GraphqlType.string(),
            },
        )

        api.add_type(model_object_type)

        api.add_query(
            "getAllModels",
            appsync.ResolvableField(
                return_type=model_object_type.attribute(is_list=True),
                data_source=models_data_source,
            ),
        )
        api.add_mutation(
            "addModel",
            appsync.ResolvableField(
                args={
                    "modelKey": appsync.GraphqlType.string(is_required=True),
                    "racerName": appsync.GraphqlType.string(is_required=True),
                    "racerIdentityId": appsync.GraphqlType.string(is_required=True),
                },
                return_type=model_object_type.attribute(),
                data_source=models_data_source,
            ),
        )
        api.add_subscription(
            "addedModel",
            appsync.ResolvableField(
                return_type=model_object_type.attribute(),
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
                directives=[appsync.Directive.subscribe("addModel")],
            ),
        )
        api.add_mutation(
            "updateModel",
            appsync.ResolvableField(
                args={
                    "modelId": appsync.GraphqlType.string(is_required=True),
                    "modelKey": appsync.GraphqlType.string(is_required=True),
                    "modelFilename": appsync.GraphqlType.string(),
                    "uploadedDateTime": appsync.GraphqlType.string(),
                    "md5DateTime": appsync.GraphqlType.string(),
                    "modelMD5": appsync.GraphqlType.string(),
                    "modelMetadataMD5": appsync.GraphqlType.string(),
                },
                return_type=model_object_type.attribute(),
                data_source=models_data_source,
            ),
        )
        api.add_subscription(
            "updatedModel",
            appsync.ResolvableField(
                return_type=model_object_type.attribute(),
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
                directives=[appsync.Directive.subscribe("updateModel")],
            ),
        )

        # Grant access so API methods can be invoked
        for role in roles_to_grant_invoke_access:
            role.add_to_policy(
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=["appsync:GraphQL"],
                    resources=[
                        f"{api.arn}/types/Query/fields/getAllModels",
                        f"{api.arn}/types/Mutation/fields/addModel",
                        f"{api.arn}/types/Subscription/fields/addedModel",
                        f"{api.arn}/types/Mutation/fields/updateModel",
                        f"{api.arn}/types/Subscription/fields/updatedModel",
                    ],
                )
            )
