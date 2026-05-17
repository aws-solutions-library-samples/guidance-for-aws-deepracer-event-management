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
  cloudWatchPolicy?: iam.Policy;
}
export class StandardLambdaPythonFunction extends lambdaPython.PythonFunction {
  public readonly role: iam.Role;
  public readonly nodePath: string;

  constructor(scope: Construct, id: string, props: StandardPythonFunctionProps) {
    const stack = cdk.Stack.of(scope);

    // Create a logGroup explicitly to avoid the deprecated logRetention prop being passed to super.
    // If the caller passed logRetention, use it as the retention period; otherwise default to SIX_MONTHS.
    const logGroup =
      props.logGroup ??
      new logs.LogGroup(scope, `${id}-LogGroup`, {
        retention: props.logRetention ?? logs.RetentionDays.SIX_MONTHS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

    const role =
      props.role ??
      new iam.Role(scope, `${id}-LambdaFunctionRole`, {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        description: 'IAM Role for Lambda Function',
      });

    const localProps: StandardPythonFunctionProps = {
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      architecture: lambda.Architecture.ARM_64,
      bundling:
        os.arch() === 'arm64'
          ? { image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest-arm64') }
          : { image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest') },
      ...props,
      environment: {
        ...props.environment,
        LOG_LEVEL: props.environment.LOG_LEVEL ?? 'INFO',
      },
      logGroup,
      role,
    };

    if (!localProps.layers) {
      // Powertools layer
      const powertoolsLambdaLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(
        scope,
        `${id}-lambdaPowertoolsLambdaLayer`,
        `arn:aws:lambda:${stack.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:11`
      );
      localProps.layers = [powertoolsLambdaLayer];
    }

    super(scope, id, localProps);

    const cloudWatchLogsPermissions = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [super.logGroup.logGroupArn],
    });

    if (localProps.cloudWatchPolicy) {
      localProps.cloudWatchPolicy.addStatements(cloudWatchLogsPermissions);
    } else {
      role.attachInlinePolicy(
        new iam.Policy(this, `${id}-CloudWatchLogs`, {
          statements: [cloudWatchLogsPermissions],
        })
      );
      NagSuppressions.addResourceSuppressionsByPath(stack, `${scope.node.path}/${id}/${id}-CloudWatchLogs/Resource`, [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'CloudWatch Logs permissions require a wildcard as streams are created dynamically.',
        },
      ]);
    }
    this.role = role;

    this.nodePath = `${scope.node.path}/${id}`;

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

    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-L1',
          reason:
            'Python 3.12 is the actively maintained runtime used across this project. Upgrading to 3.14 requires full dependency and integration validation and is tracked as a separate work item.',
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
