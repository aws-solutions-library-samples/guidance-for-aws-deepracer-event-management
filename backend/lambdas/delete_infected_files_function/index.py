import logging
import boto3
import os
import http_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')

def lambda_handler(event, context):
    try:
        logger.info(event)

        file_status = event['responsePayload']['status']
        s3_object = event['requestPayload']['Records'][0]['s3']['object']['key']

        source_bucket = os.environ.get('MODELS_S3_BUCKET')
        dest_bucket = os.environ.get('INFECTED_S3_BUCKET')

        if(file_status == "INFECTED"):
            #cant move the file with the tag as INFECTED - update tag, then move
            response = s3.put_object_tagging(
                Bucket=source_bucket,
                Key=s3_object,
                Tagging={
                    'TagSet': [
                        {
                            'Key': 'scan-status',
                            'Value': 'MOVING-INFECTED'
                        },
                    ]
                }
            )
            
            #copy the file from source to infected bucket
            copy_request = s3.copy_object(
                Bucket=dest_bucket,
                CopySource={'Bucket': source_bucket, 'Key': s3_object},
                Key=s3_object,
                Tagging='scan-status=INFECTED'
            )

            #delete original file
            s3.delete_object(Bucket=source_bucket, Key=s3_object)
        
        return http_response.response(200, {})

    except Exception as error:
        logger.error(error)
        return http_response.response(500, error)