import index
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext):
    logger.info(event)
    fleetId = event["detail"]["data"]["fleetId"]
    fleetName = event["detail"]["data"]["fleetName"]
    carIds = event["detail"]["data"]["carIds"]
    index.carUpdates(carIds, fleetId, fleetName)
    return True
