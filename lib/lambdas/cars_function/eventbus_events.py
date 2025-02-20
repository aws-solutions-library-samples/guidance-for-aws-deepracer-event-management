import index

"""
Lambda function to handle event bus events related to car updates.

This function acts as a facade for the API function in index.py. It processes
incoming events, extracts relevant data, and calls the carsUpdateFleet function
from the index module.

Args:
    event (dict): The event data passed to the Lambda function. Expected to contain
                  details about the fleet and car IDs.
    context (LambdaContext): The context in which the Lambda function is executed.

Returns:
    bool: Always returns True after processing the event.
"""
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext):
    logger.info(event)
    fleetId = event["detail"]["data"]["fleetId"]
    fleetName = event["detail"]["data"]["fleetName"]
    carIds = event["detail"]["data"]["carIds"]
    index.carsUpdateFleet(carIds, fleetId, fleetName)
    return True
