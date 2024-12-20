import { Duration, Size } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { StandardLambdaDockerImageFuncion } from './standard-lambda-docker-image-function';

interface VideoProcessorProps {
  sourceBucket: s3.IBucket;
  destinationBucket: s3.IBucket;
  appsyncApi?: {
    api: appsync.GraphqlApi;
    noneDataSource: appsync.NoneDataSource;
  };
}

export class VideoProcessor extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: VideoProcessorProps) {
    super(scope, id);

    // Create SNS topic for error notifications
    const errorTopic = new sns.Topic(this, 'VideoProcessingErrorTopic');

    // Create shared Lambda Docker image
    const sharedLambdaCode = lambda.DockerImageCode.fromImageAsset('lib/lambdas/video_processor', {
      platform: Platform.LINUX_AMD64,
      file: 'Dockerfile',
      cmd: ['app.handler'],
    });

    // Create Lambda functions with shared code but different environment variables
    const validateInput = new StandardLambdaDockerImageFuncion(this, 'ValidateInputFunction', {
      description: 'Validate video processing input',
      code: sharedLambdaCode,
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(1),
      memorySize: 128,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'videoValidateFunction',
        OPERATION_TYPE: 'VALIDATE',
      },
    });

    const downloadFile = new StandardLambdaDockerImageFuncion(this, 'DownloadFileFunction', {
      description: 'Download file from S3',
      code: sharedLambdaCode,
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'videoDownloadFunction',
        OPERATION_TYPE: 'DOWNLOAD',
      },
    });

    const processVideo = new StandardLambdaDockerImageFuncion(this, 'ProcessVideoFunction', {
      description: 'Process video file',
      code: sharedLambdaCode,
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(15),
      memorySize: 2048,
      ephemeralStorageSize: Size.gibibytes(4),
      environment: {
        POWERTOOLS_SERVICE_NAME: 'videoProcessFunction',
        OPERATION_TYPE: 'PROCESS',
      },
    });

    const uploadVideo = new StandardLambdaDockerImageFuncion(this, 'UploadVideoFunction', {
      description: 'Upload processed video',
      code: sharedLambdaCode,
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'videoUploadFunction',
        OPERATION_TYPE: 'UPLOAD',
        DESTINATION_BUCKET: props.destinationBucket.bucketName,
      },
    });

    const errorHandler = new StandardLambdaDockerImageFuncion(this, 'ErrorHandlerFunction', {
      description: 'Handle video processing errors',
      code: sharedLambdaCode,
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(1),
      memorySize: 128,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'videoErrorFunction',
        OPERATION_TYPE: 'ERROR',
        ERROR_TOPIC_ARN: errorTopic.topicArn,
      },
    });

    // Grant necessary permissions
    props.sourceBucket.grantRead(downloadFile);
    props.destinationBucket.grantWrite(uploadVideo);
    errorTopic.grantPublish(errorHandler);

    // Create Step Functions tasks
    const validateTask = new tasks.LambdaInvoke(this, 'Validate Input', {
      lambdaFunction: validateInput,
      retryOnServiceExceptions: true,
    });

    const downloadTask = new tasks.LambdaInvoke(this, 'Download File', {
      lambdaFunction: downloadFile,
      retryOnServiceExceptions: true,
    });

    const processTask = new tasks.LambdaInvoke(this, 'Process Video', {
      lambdaFunction: processVideo,
      retryOnServiceExceptions: true,
    });

    const uploadTask = new tasks.LambdaInvoke(this, 'Upload Video', {
      lambdaFunction: uploadVideo,
      retryOnServiceExceptions: true,
    });

    const errorHandlerTask = new tasks.LambdaInvoke(this, 'Handle Error', {
      lambdaFunction: errorHandler,
      retryOnServiceExceptions: true,
    });

    // Create Step Functions definition
    const definition = validateTask.next(downloadTask).next(processTask).next(uploadTask);

    // Create State Machine
    this.stateMachine = new sfn.StateMachine(this, 'VideoProcessingStateMachine', {
      definition,
      timeout: Duration.minutes(30),
      tracingEnabled: true,
      stateMachineType: sfn.StateMachineType.STANDARD,
    });

    // Create trigger Lambda
    const triggerFunction = new StandardLambdaDockerImageFuncion(this, 'TriggerFunction', {
      description: 'Trigger video processing workflow',
      code: lambda.DockerImageCode.fromImageAsset('lib/lambdas/video_processor', {
        platform: Platform.LINUX_AMD64,
        file: 'Dockerfile',
        cmd: ['trigger.handler'],
      }),
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(1),
      memorySize: 128,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'videoTriggerFunction',
        STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
      },
    });

    // Grant permission to start execution
    this.stateMachine.grantStartExecution(triggerFunction);

    // Add S3 event notification if needed
    props.sourceBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(triggerFunction),
      { prefix: 'uploads/' } // Optional: configure specific prefix
    );
  }
}
