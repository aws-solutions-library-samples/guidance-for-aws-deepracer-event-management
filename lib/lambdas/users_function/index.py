import json
import os
from datetime import date, datetime

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

session = boto3.session.Session()
region = session.region_name or "eu-west-1"

client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError("Type %s not serializable" % type(obj))


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="listUsers")
def listUsers():
    try:
        # TODO: Probably need to change this to a paging request so the frontend
        #       can send a request for the next page

        paginator = client_cognito.get_paginator("list_users")
        response_iterator = paginator.paginate(
            UserPoolId=user_pool_id,
            PaginationConfig={
                "PageSize": 30,
            },
        )

        users = []
        for r in response_iterator:
            users.append(r["Users"])
            # send batch of results to appsync end point...

        # Squash the list of lists
        # Won't need to do this once we are sending
        # batches of results to appsync end point...
        all_users = [item for sublist in users for item in sublist]
        # logger.info(all_users)

        temp = json.dumps(all_users, default=json_serial)  # sort out datetime
        temp2 = json.loads(temp)
        # logger.info(temp2)
        return temp2
        # return "submitted request"

    except Exception as error:
        logger.exception(error)
        return error
