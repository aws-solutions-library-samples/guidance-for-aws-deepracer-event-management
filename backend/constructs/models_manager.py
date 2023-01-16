from aws_cdk import DockerImage, Duration, RemovalPolicy, Stack
from aws_cdk import aws_apigateway as apig
from aws_cdk import aws_appsync_alpha as appsync
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as awslambda
from aws_cdk import aws_lambda_destinations as lambda_destinations
from aws_cdk import aws_lambda_event_sources as aws_lambda_event_sources
from aws_cdk import aws_lambda_python_alpha as lambda_python
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_deployment as s3_deployment
from aws_cdk import aws_sqs as sqs
from cdk_serverless_clamscan import ServerlessClamscan
from constructs import Construct

from backend.BaseStack import BaseStack


class ModelsManager(Construct):
    @property
    def models_bucket(self) -> s3.IBucket:
        return self._models_bucket

    @property
    def infected_bucket(self) -> s3.IBucket:
        return self._infected_bucket

    def __init__(
        self,
        scope: Construct,
        id: str,
        api: appsync.IGraphqlApi,
        none_data_source: appsync.NoneDataSource,
        base_stack: BaseStack,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        stack = Stack.of(self)

        # Models S3 bucket
        self._models_bucket = s3.Bucket(
            self,
            "models_bucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=base_stack.logs_bucket,
            server_access_logs_prefix="access-logs/models_bucket/",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=Duration.days(15), tag_filters={"lifecycle": "true"}
                ),
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1)
                ),
            ],
        )

        self._models_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[
                    self._models_bucket.bucket_arn,
                    self._models_bucket.bucket_arn + "/*",
                ],
                conditions={"NumericLessThan": {"s3:TlsVersion": "1.2"}},
            )
        )

        # Deploy Default Models
        s3_deployment.BucketDeployment(
            self,
            "ModelsDeploy",
            sources=[
                s3_deployment.Source.asset(
                    path="./backend/default_models",
                ),
            ],
            destination_bucket=self._models_bucket,
            destination_key_prefix=(
                "private/{}:00000000-0000-0000-0000-000000000000/default/models/"
                .format(stack.region)
            ),
            retain_on_delete=False,
        )

        self._infected_bucket = s3.Bucket(
            self,
            "infected_bucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            server_access_logs_bucket=base_stack.logs_bucket,
            server_access_logs_prefix="access-logs/infected_bucket/",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            auto_delete_objects=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[
                s3.LifecycleRule(expiration=Duration.days(1)),
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1)
                ),
            ],
        )

        self._infected_bucket.policy.document.add_statements(
            iam.PolicyStatement(
                sid="AllowSSLRequestsOnly",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[
                    self._infected_bucket.bucket_arn,
                    self._infected_bucket.bucket_arn + "/*",
                ],
                conditions={"NumericLessThan": {"s3:TlsVersion": "1.2"}},
            )
        )

        # Models table, used by delete_infected_files_function and also models_manager
        models_table = dynamodb.Table(
            self,
            "ModelsTable",
            partition_key=dynamodb.Attribute(
                name="modelId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption=dynamodb.TableEncryption.AWS_MANAGED,
            stream=dynamodb.StreamViewType.NEW_IMAGE,
            removal_policy=RemovalPolicy.DESTROY,
        )
        models_table.add_global_secondary_index(
            index_name="racerNameIndex",
            partition_key=dynamodb.Attribute(
                name="racerName", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="modelId", type=dynamodb.AttributeType.STRING
            ),
            non_key_attributes=["modelKey", "modelFilename"],
            projection_type=dynamodb.ProjectionType.INCLUDE,
        )

        delete_infected_files_function = lambda_python.PythonFunction(
            self,
            "delete_infected_files_function",
            entry="backend/lambdas/delete_infected_files_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=256,
            architecture=base_stack._lambda_architecture,
            environment={
                "DDB_TABLE": models_table.table_name,
                "MODELS_S3_BUCKET": self._models_bucket.bucket_name,
                "INFECTED_S3_BUCKET": self._infected_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "delete_infected_files",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )

        # Bucket and DynamoDB permissions
        self._models_bucket.grant_read_write(delete_infected_files_function, "*")
        self._infected_bucket.grant_read_write(delete_infected_files_function, "*")
        models_table.grant_read_write_data(delete_infected_files_function)

        # Add clam av scan to S3 uploads bucket
        bucketList = [self._models_bucket]
        ServerlessClamscan(
            self,
            "rClamScan",
            buckets=bucketList,
            on_result=lambda_destinations.LambdaDestination(
                delete_infected_files_function
            ),
            on_error=lambda_destinations.LambdaDestination(
                delete_infected_files_function
            ),
        )

        # Models Function
        models_function = lambda_python.PythonFunction(
            self,
            "get_models_function",
            entry="backend/lambdas/get_models_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "bucket": self._models_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "get_models",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )

        # Permissions for s3 bucket read
        self._models_bucket.grant_read(models_function, "private/*")

        # Quarantine Models Function
        quarantined_models_function = lambda_python.PythonFunction(
            self,
            "get_quarantined_models_function",
            entry="backend/lambdas/get_quarantined_models_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "infected_bucket": self._infected_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "get_quarantined_models",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer],
        )

        # # permissions for s3 bucket read
        self._infected_bucket.grant_read(quarantined_models_function, "private/*")

        # upload_model_to_car_function
        upload_model_to_car_function = lambda_python.PythonFunction(
            self,
            "upload_model_to_car_function",
            entry="backend/lambdas/upload_model_to_car_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "bucket": self._models_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "upload_model_to_car",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )
        upload_model_to_car_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:GetCommandInvocation",
                    "ssm:SendCommand",
                ],
                resources=["*"],
            )
        )

        # upload_model_to_car_function
        upload_model_to_car_status_function = lambda_python.PythonFunction(
            self,
            "upload_model_to_car_status_function",
            entry="backend/lambdas/upload_model_to_car_status_function/",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "POWERTOOLS_SERVICE_NAME": "upload_model_to_car_status",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )

        upload_model_to_car_status_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:GetCommandInvocation",
                ],
                resources=["*"],
            )
        )
        # permissions for s3 bucket read
        self._models_bucket.grant_read(upload_model_to_car_function, "private/*")

        self._models_bucket.add_cors_rule(
            allowed_headers=["*"],
            allowed_methods=[
                s3.HttpMethods.PUT,
                s3.HttpMethods.POST,
                s3.HttpMethods.GET,
                s3.HttpMethods.HEAD,
                s3.HttpMethods.DELETE,
            ],
            allowed_origins=[
                "*",
                # "http://localhost:3000",
                # "https://" + distribution.distribution_domain_name
            ],
            exposed_headers=[
                "x-amz-server-side-encryption",
                "x-amz-request-id",
                "x-amz-id-2",
                "ETag",
            ],
            max_age=3000,
        )

        self._models_bucket.grant_read(base_stack.idp.admin_user_role, "*")
        self._models_bucket.grant_read(base_stack.idp.operator_user_role, "*")

        models_md5_handler = lambda_python.PythonFunction(
            self,
            "modelsMD5Function",
            entry="backend/lambdas/models_md5/",
            description="Check MD5 on model files",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "DDB_TABLE": models_table.table_name,
                "MODELS_S3_BUCKET": self._models_bucket.bucket_name,
                "POWERTOOLS_SERVICE_NAME": "md5_models",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
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
        self._models_bucket.grant_read_write(models_md5_handler, "private/*")

        models_handler = lambda_python.PythonFunction(
            self,
            "modelsFunction",
            entry="backend/lambdas/models_function/",
            description="Models resolver",
            index="index.py",
            handler="lambda_handler",
            timeout=Duration.minutes(1),
            runtime=base_stack._lambda_runtime,
            tracing=awslambda.Tracing.ACTIVE,
            memory_size=128,
            architecture=base_stack._lambda_architecture,
            environment={
                "DDB_TABLE": models_table.table_name,
                "POWERTOOLS_SERVICE_NAME": "models resolver",
                "LOG_LEVEL": base_stack._powertools_log_level,
            },
            bundling=lambda_python.BundlingOptions(
                image=base_stack._lambda_bundling_image
            ),
            layers=[base_stack._helper_functions_layer, base_stack._powertools_layer],
        )

        models_table.grant_read_write_data(models_handler)

        # Define the data source for the API
        models_data_source = api.add_lambda_data_source(
            "ModelsDataSource", models_handler
        )

        # GraphQL API
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

        api.add_query(
            "getModelsForUser",
            appsync.ResolvableField(
                args={
                    "racerName": appsync.GraphqlType.string(is_required=True),
                },
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

        # REST API
        api_admin_quarantined_models = base_stack.rest_api.admin_api_node.add_resource(
            "quarantinedmodels"
        )

        api_admin_quarantined_models.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=quarantined_models_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        api_models = base_stack.rest_api.rest_api.root.add_resource("models")
        api_models.add_method(
            http_method="GET",
            integration=apig.LambdaIntegration(handler=models_function),
            authorization_type=apig.AuthorizationType.IAM,
        )

        api_cars = base_stack.rest_api.rest_api.root.add_resource("cars")

        self.api_cars_upload = api_cars.add_resource("upload")

        instanceid_model = base_stack.rest_api.rest_api.add_model(
            "InstanceIdModel",
            content_type="application/json",
            schema=apig.JsonSchema(
                schema=apig.JsonSchemaVersion.DRAFT4,
                type=apig.JsonSchemaType.OBJECT,
                properties={
                    "InstanceId": apig.JsonSchema(type=apig.JsonSchemaType.STRING),
                },
            ),
        )

        self.api_cars_upload.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(handler=upload_model_to_car_function),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={"application/json": instanceid_model},
            request_validator=base_stack.rest_api._body_validator,
        )

        api_cars_upload_status = self.api_cars_upload.add_resource("status")
        api_cars_upload_status.add_method(
            http_method="POST",
            integration=apig.LambdaIntegration(
                handler=upload_model_to_car_status_function
            ),
            authorization_type=apig.AuthorizationType.IAM,
            request_models={
                "application/json": base_stack.rest_api._instanceid_commandid_model
            },
            request_validator=base_stack.rest_api._body_validator,
        )

        # Grant access so API methods can be invoked

        base_stack.idp.admin_user_role.add_to_principal_policy(
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
