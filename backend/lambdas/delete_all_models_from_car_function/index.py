from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from botocore.exceptions import ClientError
import simplejson as json
import boto3
import http_response

logger = Logger()

client_ssm = boto3.client('ssm')


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        logger.info(json.dumps(event))

        body_parameters = json.loads(event['body'])
        instance_id = body_parameters['InstanceId']

        # empty the artifacts folder
        logger.info(instance_id)
        try:
            response = client_ssm.send_command(
                InstanceIds=[instance_id],
                DocumentName="AWS-RunShellScript",
                Parameters={'commands': [
                    "rm -rf /opt/aws/deepracer/artifacts/*",
                    "rm -rf /root/.ros/log/*"
                ]}
            )
            command_id = response['Command']['CommandId']
            logger.info(command_id)

            return http_response.response(200, command_id)

        except ClientError as e:
            logger.exception(e.response)
            error_message = e.response['Error']['Message']
            http_status_code = e.response['ResponseMetadata']['HTTPStatusCode']
            return http_response.response(http_status_code, error_message)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
