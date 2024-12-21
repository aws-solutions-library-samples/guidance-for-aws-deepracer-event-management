import os
import boto3
import json
from aws_lambda_powertools import Logger
from moviepy.editor import VideoFileClip, ImageClip

logger = Logger()
s3_client = boto3.client('s3')
sns_client = boto3.client('sns')

class VideoOperations:
    @staticmethod
    def validate(event):
        source_bucket = event['source_bucket']
        file_key = event['file_key']
        
        # Add validation logic here
        return {
            'source_bucket': source_bucket,
            'file_key': file_key,
            'temp_path': f'/tmp/{file_key}'
        }

    @staticmethod
    def download(event):
        s3_client.download_file(
            event['Payload']['source_bucket'],
            event['Payload']['file_key'],
            event['Payload']['temp_path']
        )
        return event['Payload']

    @staticmethod
    def process(event):
        input_path = event['Payload']['temp_path']
        output_path = f"{input_path}_processed.mp4"
        
        # Video processing logic here
        clip = VideoFileClip(input_path)
        # Add your video processing steps
        clip.write_videofile(output_path)
        
        return {
            **event['Payload'],
            'processed_path': output_path
        }

    @staticmethod
    def upload(event):
        destination_bucket = os.environ['DESTINATION_BUCKET']
        output_key = f"processed/{event['Payload']['file_key']}.mp4"
        
        s3_client.upload_file(
            event['Payload']['processed_path'],
            destination_bucket,
            output_key
        )
        
        # Clean up
        os.remove(event['Payload']['temp_path'])
        os.remove(event['Payload']['processed_path'])
        
        return {
            'status': 'success',
            'output_location': f"s3://{destination_bucket}/{output_key}"
        }

    @staticmethod
    def handle_error(event):
        error = event.get('Error', 'Unknown error')
        cause = event.get('Cause', 'Unknown cause')
        
        sns_client.publish(
            TopicArn=os.environ['ERROR_TOPIC_ARN'],
            Message=f"Video processing failed: {error}\nCause: {cause}"
        )
        return {
            'status': 'error',
            'error': error,
            'cause': cause
        }

@logger.inject_lambda_context
def lambda_handler(event, context):
    operation = os.environ['OPERATION_TYPE']
    logger.info(f"Processing operation: {operation}", extra={"event": event})
    
    operations = {
        'VALIDATE': VideoOperations.validate,
        'DOWNLOAD': VideoOperations.download,
        'PROCESS': VideoOperations.process,
        'UPLOAD': VideoOperations.upload,
        'ERROR': VideoOperations.handle_error
    }
    
    try:
        operation_handler = operations.get(operation)
        if not operation_handler:
            raise ValueError(f"Unknown operation type: {operation}")
            
        result = operation_handler(event)
        return result
    except Exception as e:
        logger.exception(f"Error in {operation}")
        raise
