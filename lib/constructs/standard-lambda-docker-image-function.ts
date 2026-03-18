import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface StandardLambdaDockerImageFuncionProps extends lambda.DockerImageFunctionProps {
  logRetention?: logs.RetentionDays;
  role?: iam.Role;
  tracing?: lambda.Tracing;
}

export class StandardLambdaDockerImageFuncion extends lambda.DockerImageFunction {
  public readonly role: iam.Role;
  public readonly nodePath: string;

  constructor(scope: Construct, id: string, props: StandardLambdaDockerImageFuncionProps) {
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

    const localProps = {
      tracing: lambda.Tracing.ACTIVE,
      ...props,
      logGroup,
      role,
    };

    super(scope, id, localProps);

    const cloudWatchLogsPermissions = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [super.logGroup.logGroupArn],
    });

    role.attachInlinePolicy(
      new iam.Policy(this, `${id}-CloudWatchLogs`, {
        statements: [cloudWatchLogsPermissions],
      })
    );
    this.role = role;

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
}
