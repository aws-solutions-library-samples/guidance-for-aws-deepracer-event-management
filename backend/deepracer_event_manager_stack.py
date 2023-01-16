from aws_cdk import CfnOutput, DockerImage, Duration, RemovalPolicy, Stack
from aws_cdk import aws_apigateway as apig
from aws_cdk import aws_appsync_alpha as appsync
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as awslambda
from aws_cdk import aws_lambda_destinations as lambda_destinations
from aws_cdk import aws_lambda_python_alpha as lambda_python
from aws_cdk import aws_logs as logs
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_deployment as s3_deployment
from cdk_serverless_clamscan import ServerlessClamscan
from constructs import Construct

from backend.constructs.cars_manager import CarsManager
from backend.constructs.common import BaseStack
from backend.constructs.cwrum_construct import CwRumAppMonitor
from backend.constructs.events_manager import EventsManager
from backend.constructs.fleets_manager import FleetsManager
from backend.constructs.group_manager import GroupManager
from backend.constructs.label_printer import LabelPrinter
from backend.constructs.leaderboard_construct import Leaderboard
from backend.constructs.models_manager import ModelsManager

# from backend.systems_manager import SystemsManager
from backend.constructs.terms_n_conditions.tnc_construct import TermsAndConditions
from backend.constructs.user_manager import UserManager
from backend.constructs.website import Website


class CdkDeepRacerEventManagerStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        email: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # setup for pseudo parameters
        stack = Stack.of(self)

        base_stack = BaseStack(self, "Base", email=email)

        # # Appsync API
        # Cannot be moved to base_stack due issue
        appsync_api = appsync.GraphqlApi(
            self,
            "graphql",
            authorization_config=appsync.AuthorizationConfig(
                default_authorization=appsync.AuthorizationMode(
                    authorization_type=appsync.AuthorizationType.IAM
                )
            ),
            name=f"api-{stack.stack_name}",
            xray_enabled=True,
            log_config=appsync.LogConfig(retention=logs.RetentionDays.ONE_WEEK),
        )
        none_data_source = appsync_api.add_none_data_source("none")

        EventsManager(
            self,
            "EventsManager",
            api=appsync_api,
            none_data_source=none_data_source,
            user_pool=base_stack.idp.user_pool,
            powertools_layer=base_stack._powertools_layer,
            powertools_log_level=base_stack._powertools_log_level,
            lambda_architecture=base_stack._lambda_architecture,
            lambda_runtime=base_stack._lambda_runtime,
            lambda_bundling_image=base_stack._lambda_bundling_image,
            roles_to_grant_invoke_access=[base_stack.idp.admin_user_role],
        )

        FleetsManager(
            self,
            "FleetsManager",
            api=appsync_api,
            none_data_source=none_data_source,
            user_pool=base_stack.idp.user_pool,
            powertools_layer=base_stack._powertools_layer,
            powertools_log_level=base_stack._powertools_log_level,
            lambda_architecture=base_stack._lambda_architecture,
            lambda_runtime=base_stack._lambda_runtime,
            lambda_bundling_image=base_stack._lambda_bundling_image,
            roles_to_grant_invoke_access=[base_stack.idp.admin_user_role],
        )

        CarsManager(
            self,
            "CarsManager",
            api=appsync_api,
            powertools_layer=base_stack._powertools_layer,
            powertools_log_level=base_stack._powertools_log_level,
            lambda_architecture=base_stack._lambda_architecture,
            lambda_runtime=base_stack._lambda_runtime,
            lambda_bundling_image=base_stack._lambda_bundling_image,
            roles_to_grant_invoke_access=[base_stack.idp.admin_user_role],
        )

        # # SystemsManager(self, "SystemsManager")

        models_manager = ModelsManager(
            self,
            "ModelsManager",
            api=appsync_api,
            none_data_source=none_data_source,
            base_stack=base_stack,
        )

        # Terms And Conditions
        tnc_website = Website(
            self,
            "TermsNConditions",
            content_path="./backend/constructs/terms_n_conditions/webpage/",
            logs_bucket=base_stack.logs_bucket,
        )

        base_stack.cloudfront_distribution.add_behavior(
            path_pattern="terms_and_conditions.html", origin=tnc_website.origin
        )

        GroupManager(self, "groupManager", base_stack=base_stack)

        UserManager(self, "userManager", base_stack=base_stack)

        LabelPrinter(
            self,
            "LabelPrinter",
            api_cars_upload=models_manager.api_cars_upload,
            base_stack=base_stack,
        )

        # Grant API Invoke permissions to admin users
        # TODO split up and move to correct construct
        # TODO: Ensure only users in the correct group can call the API endpoints
        # https://aws.amazon.com/blogs/compute/secure-api-access-with-amazon-cognito-federated-identities-amazon-cognito-user-pools-and-amazon-api-gateway/
        base_stack.idp.admin_user_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["execute-api:Invoke"],
                resources=[
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="GET", path="/models"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="GET", path="/cars/label"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="POST", path="/cars/upload"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="POST", path="/cars/upload/status"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="GET", path="/users"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="GET", path="/admin/quarantinedmodels"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="GET", path="/admin/groups"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="POST", path="/admin/groups"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="DELETE", path="/admin/groups"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="GET", path="/admin/groups/*"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="POST", path="/admin/groups/*"
                    ),
                    base_stack.rest_api.rest_api.arn_for_execute_api(
                        method="DELETE", path="/admin/groups/*"
                    ),
                ],
            )
        )

        # RUM
        cw_rum_app_monitor = CwRumAppMonitor(
            self,
            "CwRumAppMonitor",
            domain_name=base_stack.cloudfront_distribution.distribution_domain_name,
        )
        # End RUM

        # Leaderboard
        Leaderboard(self, "Leaderboard", api=appsync_api, base_stack=base_stack)

        # Outputs
        CfnOutput(
            self,
            "CFURL",
            value="https://"
            + base_stack.cloudfront_distribution.distribution_domain_name,
        )

        CfnOutput(
            self,
            "distributionId",
            value=base_stack.cloudfront_distribution.distribution_id,
        )

        CfnOutput(
            self, "sourceBucketName", value=base_stack.drem_website.bucket.bucket_name
        )

        CfnOutput(
            self, "modelsBucketName", value=models_manager.models_bucket.bucket_name
        )

        CfnOutput(
            self, "infectedBucketName", value=models_manager.infected_bucket.bucket_name
        )

        CfnOutput(self, "stackRegion", value=stack.region)

        CfnOutput(self, "region", value=stack.region)

        CfnOutput(self, "apiUrl", value=base_stack.rest_api.rest_api.url)

        CfnOutput(self, "appsyncEndpoint", value=appsync_api.graphql_url)

        CfnOutput(self, "rumScript", value=cw_rum_app_monitor.script)

        CfnOutput(self, "appsyncId", value=appsync_api.api_id)
