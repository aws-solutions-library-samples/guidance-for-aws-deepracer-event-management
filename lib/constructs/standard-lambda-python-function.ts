import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import * as os from 'os';

export interface StandardPythonFunctionProps extends lambdaPython.PythonFunctionProps {
  index?: string;
  handler?: string;
  timeout?: Duration;
  tracing?: lambda.Tracing;
  memorySize?: number;
  architecture?: lambda.Architecture;
  bundling?: {
    image: DockerImage;
  };
  layers?: lambda.ILayerVersion[];
  environment: {
    POWERTOOLS_SERVICE_NAME: string;
    LOG_LEVEL?: string;
    [others: string]: any;
  };
  logRetention?: logs.RetentionDays;
  role?: iam.Role;
}
export class StandardLambdaPythonFunction extends lambdaPython.PythonFunction {
  public readonly role: iam.Role;
  public readonly nodePath: string;

  constructor(scope: Construct, id: string, props: StandardPythonFunctionProps) {
    const stack = cdk.Stack.of(scope);

    var localProps = props;

    // set defaults if not supplied
    if (!localProps.index) {
      localProps.index = 'index.py';
    }
    if (!localProps.handler) {
      localProps.handler = 'lambda_handler';
    }
    if (!localProps.timeout) {
      localProps.timeout = Duration.minutes(1);
    }
    if (!localProps.tracing) {
      localProps.tracing = lambda.Tracing.ACTIVE;
    }
    if (!localProps.memorySize) {
      localProps.memorySize = 128;
    }
    if (!localProps.architecture) {
      localProps.architecture = lambda.Architecture.ARM_64;
    }
    if (!localProps.bundling) {
      if (os.arch() === 'arm64') {
        console.log('OS: ', os.arch());
        localProps.bundling = {
          image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest-arm64'),
        };
      } else {
        localProps.bundling = {
          image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest'),
        };
      }
    }
    if (!localProps.layers) {
      // Powertools layer
      const powertoolsLambdaLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(
        scope,
        `${id}-lambdaPowertoolsLambdaLayer`,
        `arn:aws:lambda:${stack.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:11`
      );
      localProps.layers = [powertoolsLambdaLayer];
    }
    if (!localProps.environment.LOG_LEVEL) {
      localProps.environment.LOG_LEVEL = 'INFO';
    }
    if (!localProps.logRetention) {
      localProps.logRetention = logs.RetentionDays.SIX_MONTHS;
    }
    if (!localProps.role) {
      localProps.role = new iam.Role(scope, `${id}-LambdaFunctionRole`, {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        description: 'IAM Role for Lambda Function',
      });
    }

    super(scope, id, localProps);

    const cloudWatchLogsPermissions = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [super.logGroup.logGroupArn],
    });

    localProps.role.attachInlinePolicy(
      new iam.Policy(this, `${id}-CloudWatchLogs`, {
        statements: [cloudWatchLogsPermissions],
      })
    );
    this.role = localProps.role;

    this.nodePath = `${scope.node.path}/${id}`;
    NagSuppressions.addResourceSuppressionsByPath(stack, `${scope.node.path}/${id}/${id}-CloudWatchLogs/Resource`, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'CloudWatch Logs permissions require a wildcard as streams are created dynamically.',
      },
    ]);

    NagSuppressions.addResourceSuppressions(
      this.role,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            "Suppress AwsSolutions-IAM5 'xray:PutTelemetryRecords' and 'xray:PutTraceSegments' on *, which is created when CDK enables tracing",
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );
  }
  public addAdditionalRolePolicy(id: string, PolicyStatement: iam.PolicyStatement): { resourcePath: string } {
    const suffix = '-AdditionalRolePolicy';
    this.role.attachInlinePolicy(
      new iam.Policy(this, id + suffix, {
        statements: [PolicyStatement],
      })
    );
    return { resourcePath: `${this.nodePath}/${id}${suffix}/Resource` };
  }
}
