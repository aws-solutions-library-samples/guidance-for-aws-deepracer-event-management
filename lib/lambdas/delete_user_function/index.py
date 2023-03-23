import os

import json
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]

# add event bus
client = boto3.client("events")
eventbus_name = os.environ["eventbus_name"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    
    return_data = {
        "Deleted": False,
        "Username": "",
    }
    
    try:
        # get the username from the form submission
        username = event['arguments']['username']
        
        # get the cognito auth string
        cognito_auth = event['identity']['cognitoIdentityAuthProvider']

        # get the user that was sent as part of the request        
        user = client_cognito.admin_get_user(
            UserPoolId=user_pool_id,
            Username=username
        )
        logger.info(user)

        if (user['UserAttributes'][0]['Name'] == "sub"):
            if "CognitoSignIn:"+user['UserAttributes'][0]['Value'] in cognito_auth:
                logger.info("user is logged in and exists (delete user!)")
                response = client_cognito.admin_delete_user(
                    UserPoolId=user_pool_id,
                    Username=user['Username']
                )
                logger.info(response)
                
                return_data['Deleted'] = True
                return_data['Username'] = user['Username']

                #put event into event bus that user deleted
                detail = {
                    "metadata": {
                        "service": "cognito",
                        "domain": "DREM",
                    },
                    "data": event,
                }

                e_response = client.put_events(
                    Entries=[
                        {
                            "Source": "user",
                            "DetailType": "userDeleted",
                            "Detail": json.dumps(detail),
                            "EventBusName": eventbus_name,
                        },
                    ]
                )
                logger.info(e_response)
            else:
                logger.info("userdoes not exist (dont delete error)")
        
        logger.info(return_data)
        return return_data
    except Exception as error:
        logger.exception(error)
        return error
