from os import (
    path,
    getcwd
)

from aws_cdk import (
    Stack,
    aws_appsync_alpha as appsync,
    aws_logs as logs
)

from constructs import Construct

class API(Construct):

    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        stack = Stack.of(self)

        self.api = appsync.GraphqlApi(self, 'dremApi',
            #schema=appsync.Schema.from_asset(path.join(getcwd(), "backend/leaderboard/schema.graphql")),
            authorization_config=appsync.AuthorizationConfig(
                default_authorization=appsync.AuthorizationMode(
                    authorization_type=appsync.AuthorizationType.IAM
                )
            ),
            name=f'api-{stack.stack_name}',
            xray_enabled=True,
            log_config=appsync.LogConfig(
                retention=logs.RetentionDays.ONE_WEEK
            )
        )
