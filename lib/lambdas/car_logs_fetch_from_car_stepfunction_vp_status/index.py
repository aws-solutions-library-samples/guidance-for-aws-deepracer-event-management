import os
import appsync_helpers
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils
from botocore.exceptions import ClientError

tracer = Tracer()
logger = Logger()

client_batch = boto3.client("batch")
jobQueue = os.environ["JOB_QUEUE"]


@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)

    jobId = event["data"]["jobId"]
    carInstanceId = event["data"]["carInstanceId"]
    batchJobId = event["data"]["processing"]["batchJobId"]
    eventId = event["data"]["eventId"]

    logger.info(
        f"Updating status for JobId {jobId}, CarInstanceId {carInstanceId}, BatchId {batchJobId}"
    )

    ## AWS Batch code
    try:
        results = client_batch.describe_jobs(jobs=[batchJobId])
        logger.info(results)
        if len(results["jobs"]) == 1:
            result = results["jobs"][0]
            batchJobStatus = result["status"]

        systemStatus = "ANALYZED"
        if batchJobStatus in ["PENDING", "RUNNABLE"]:
            systemStatus = "QUEUED_FOR_PROCESSING"
        elif batchJobStatus in ["STARTING", "RUNNING"]:
            systemStatus = "PROCESSING"
        elif batchJobStatus in "SUCCEEDED":
            systemStatus = "DONE"
        else:
            systemStatus = "FAILED"

        logger.info(
            f"Updated Stats - JobId: {jobId}, status:"
            f" {batchJobStatus}, systemStatus: {systemStatus}",
        )

        item_completed = {
            "jobId": jobId,
            "status": systemStatus,
        }
        if batchJobStatus == "SUCCEEDED":
            item_completed["endTime"] = scalar_types_utils.aws_datetime()

        try:
            query = """mutation updateFetchFromCarDbEntry($jobId: ID!, $status: CarLogsFetchStatus!, $endTime: AWSDateTime, $fetchStartTime: AWSDateTime, $uploadKey: String) {
                updateFetchFromCarDbEntry(jobId: $jobId, status: $status, endTime: $endTime, fetchStartTime: $fetchStartTime, uploadKey: $uploadKey) {
                    carInstanceId
                    carName
                    carFleetId
                    carFleetName
                    carIpAddress
                    eventId
                    eventName
                    jobId
                    laterThan
                    startTime
                    fetchStartTime
                    status
                    endTime
                    uploadKey
                }
            }
            """
            result = appsync_helpers.send_mutation(query, item_completed)
            if not result:
                raise Exception("Error sending mutation")

        except Exception as error:
            logger.exception(error)
            raise error

        return {
            "batchJobId": batchJobId,
            "status": batchJobStatus,
        }

    except Exception as error:
        logger.exception(error)
        raise error
