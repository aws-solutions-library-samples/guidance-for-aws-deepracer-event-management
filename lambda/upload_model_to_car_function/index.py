import logging
import simplejson as json
import boto3
import os
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_ssm = boto3.client('ssm')
bucket = os.environ["bucket"]

def lambda_handler(event, context):
    # function goes here
    logger.info(json.dumps(event))

    body_parameters=json.loads(event['body'])
    instance_id=body_parameters['InstanceId']
    
    #key_scope='private/'
    #key=key_scope + body_parameters['key']
    key=body_parameters['key']
    username=key.split('/')[-3]
    filename=key.split('/')[-1]
    foldername="{}-{}".format(username,filename.split('.')[0])

    logger.info(instance_id)
    logger.info(key)

    status_code = 200

    # Generate a presigned URL for the S3 object
    s3_client = boto3.client('s3')
    try:
        presigned_url = s3_client.generate_presigned_url('get_object',
            Params={
                'Bucket': bucket,
                'Key': key
            },
            ExpiresIn=300
        )
    except ClientError as e:
        logging.error(e)
        status_code = 500
        
    logger.info(json.dumps(presigned_url))

    response = client_ssm.send_command(
        InstanceIds=[instance_id],
        DocumentName="AWS-RunShellScript",
        Parameters={'commands': [
            "curl '{0}' -s --output /tmp/{1}".format(presigned_url, filename),
            "rm -rf /opt/aws/deepracer/artifacts/{0}/".format(foldername),
            "mkdir /opt/aws/deepracer/artifacts/{0}/".format(foldername),
            "tar zxvf /tmp/{0} -C /opt/aws/deepracer/artifacts/{1}/".format(filename,foldername),
            "rm /tmp/{0}".format(filename),
            "mv /opt/aws/deepracer/artifacts/{0}/agent/model.pb /opt/aws/deepracer/artifacts/{0}/model.pb".format(foldername),
            "md5sum /opt/aws/deepracer/artifacts/{0}/model.pb | awk '{{ print $1 }}' > /opt/aws/deepracer/artifacts/{0}/checksum.txt".format(foldername),
        ]}
    )
    command_id = response['Command']['CommandId']
    logger.info(command_id)
    #output = client_ssm.get_command_invocation(
    #    CommandId=command_id,
    #    InstanceId=instance_id,
    #)
    #logger.info(output)

    return {
        'headers': { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*", # Required for CORS support to work
            "Access-Control-Allow-Credentials" : True # Required for cookies, authorization headers with HTTPS 
        },
        'statusCode': status_code,
        'body': json.dumps(command_id)
    }
