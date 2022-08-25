import logging
import simplejson as json
import boto3
import http_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_ssm = boto3.client('ssm')


def lambda_handler(event, context):
    try:
        logger.info(json.dumps(event))

        body_parameters = json.loads(event['body'])
        instance_id = body_parameters['InstanceId']
        command_id = body_parameters['CommandId']

        logger.info(instance_id)
        logger.info(command_id)

        status_code = 200

        logger.info(command_id)
        result = client_ssm.get_command_invocation(
            CommandId=command_id,
            InstanceId=instance_id,
        )
        output = result['Status']
        logger.info(json.dumps(output))

        return http_response.response(status_code, output)

    except Exception as error:
        logger.error(error)
        return http_response.response(500, error)
