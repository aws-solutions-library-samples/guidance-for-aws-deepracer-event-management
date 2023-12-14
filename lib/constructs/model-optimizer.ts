import { Duration, Size } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { EventBus, Match, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { CodeFirstSchema } from 'awscdk-appsync-utils';

import { Construct } from 'constructs';
import { StandardLambdaDockerImageFuncion } from './standard-lambda-docker-image-function';

interface ModelOptimizerProps {
  modelsBucket: s3.IBucket;
  logsBucket: s3.IBucket;
  account: string;
  appsyncApi: {
    schema: CodeFirstSchema;
    api: appsync.GraphqlApi;
    noneDataSource: appsync.NoneDataSource;
  };
  eventbus: EventBus;
  clamScanPost: lambda.IFunction;
}

export class ModelOptimizer extends Construct {
  constructor(scope: Construct, id: string, props: ModelOptimizerProps) {
    super(scope, id);

    const modelOptimizer = new StandardLambdaDockerImageFuncion(this, 'ModelsOptimizerFunction', {
      description: 'Optimize uploaded model',
      code: lambda.DockerImageCode.fromImageAsset('lib/lambdas/models_optimize', {
        platform: Platform.LINUX_AMD64,
      }),
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(5),
      memorySize: 10240,
      ephemeralStorageSize: Size.gibibytes(4),
      reservedConcurrentExecutions: 20,
      retryAttempts: 2,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'modelsOptimizerFunction',
        DESTINATION_BUCKET: props.modelsBucket.bucketName,
        BUCKET_OWNER: props.account,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
    });
    props.appsyncApi.api.grantMutation(modelOptimizer, 'updateModel');

    // trigger lambda to run on s3 upload
    const optimizeRule = new Rule(this, 'Optimize Model Rule', {
      eventPattern: {
        source: ['lambda'],
        detailType: ['Lambda Function Invocation Result - Success'],
        resources: Match.prefix(props.clamScanPost.functionArn),
      },
      eventBus: props.eventbus,
    });

    optimizeRule.addTarget(
      new LambdaFunction(modelOptimizer, {
        maxEventAge: Duration.minutes(30),
        retryAttempts: 2,
      })
    );

    props.modelsBucket.grantRead(modelOptimizer);
    props.modelsBucket.grantReadWrite(modelOptimizer);
  }
}
