import * as cdk from 'aws-cdk-lib';
import { Environment, Stage } from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as notifications from 'aws-cdk-lib/aws-codestarnotifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { BaseStack } from './base-stack';
import { DeepracerEventManagerStack } from './drem-app-stack';

// Constants
const NODE_VERSION = '22'; // other possible options: stable, latest, lts
const CDK_VERSION = '2.1106.0'; // other possible options: latest
const AMPLIFY_VERSION = '12.14.4';

export interface InfrastructurePipelineStageProps extends cdk.StackProps {
  labelName: string;
  email: string;
  env: Environment;
  domainName?: string;
}

class InfrastructurePipelineStage extends Stage {
  public readonly distributionId: cdk.CfnOutput;
  public readonly sourceBucketName: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: InfrastructurePipelineStageProps) {
    super(scope, id, props);

    const baseStack = new BaseStack(this, 'base', {
      email: props.email,
      labelName: props.labelName,
      domainName: props.domainName,
    });
    const stack = new DeepracerEventManagerStack(this, 'infrastructure', {
      baseStackName: baseStack.stackName,
    });
    // Base deploys before infrastructure so SSM parameters exist when
    // CloudFormation resolves them at changeset creation time.
    stack.addDependency(baseStack);

    this.distributionId = stack.distributionId;
    this.sourceBucketName = stack.sourceBucketName;
  }
}
export interface CdkPipelineStackProps extends cdk.StackProps {
  labelName: string;
  sourceRepo: string;
  sourceBranchName: string;
  email: string;
  env: Environment;
  domainName?: string;
}

export class CdkPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkPipelineStackProps) {
    super(scope, id, props);

    // setup for pseudo parameters
    const stack = cdk.Stack.of(this);

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      dockerEnabledForSynth: true,
      publishAssetsInParallel: false,
      // Add this to fix asset publishing steps
      assetPublishingCodeBuildDefaults: {
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2023_5,
          computeType: codebuild.ComputeType.LARGE,
        },
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          phases: {
            install: {
              commands: [
                // Update Node.js first
                `n ${NODE_VERSION}`,
                'node --version',
                // Install CDK with compatible cdk-assets
                `npm install -g aws-cdk@${CDK_VERSION}`,
              ],
            },
          },
        }),
      },
      synth: new pipelines.CodeBuildStep('SynthAndDeployBackend', {
        buildEnvironment: {
          buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
          computeType: codebuild.ComputeType.LARGE,
        },
        input: pipelines.CodePipelineSource.gitHub(props.sourceRepo, props.sourceBranchName, {
          authentication: cdk.SecretValue.secretsManager('drem/github-token'),
          trigger: cdk.aws_codepipeline_actions.GitHubTrigger.POLL,
        }),
        installCommands: [
          // Update Node.js before install phase
          `n ${NODE_VERSION}`,
          'node --version',
        ],
        commands: [
          'npm install',
          `npx cdk@${CDK_VERSION} synth --all -c email=${props.email} -c label=${props.labelName}` +
            ` -c account=${props.env.account} -c region=${props.env.region}` +
            ` -c source_branch=${props.sourceBranchName} -c source_repo=${props.sourceRepo}` +
            (props.domainName ? ` -c domain_name=${props.domainName}` : ''),
        ],
        // partialBuildSpec: codebuild.BuildSpec.fromObject(
        //     {
        //         "reports": {
        //             "pytest_reports": {
        //                 "files": ["unittest-report.xml"],
        //                 "base-directory": "reports",
        //                 "file-format": "JUNITXML",
        //             }
        //         }
        //     }
        // ),
        rolePolicyStatements: [
          new iam.PolicyStatement({
            actions: ['sts:AssumeRole'],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'iam:ResourceTag/aws-cdk:bootstrap-role': 'lookup',
              },
            },
          }),
        ],
      }),
    });

    // Dev Stage
    const env = { account: stack.account, region: stack.region };

    const infrastructure = new InfrastructurePipelineStage(this, `drem-backend-${props.labelName}`, { ...props });

    const infrastructure_stage = pipeline.addStage(infrastructure, {
      pre: [new pipelines.ManualApprovalStep('DeployDREM')],
    });

    const rolePolicyStatementsForWebsiteDeployStages = [
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: ['*'],
      }),
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudfront:CreateInvalidation'],
        resources: ['*'],
      }),
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudformation:DescribeStacks'],
        resources: ['*'],
      }),
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['appsync:GetIntrospectionSchema'],
        resources: ['*'],
      }),
    ];

    // Deploy all three websites to S3 in a single step
    infrastructure_stage.addPost(
      new pipelines.CodeBuildStep('WebsiteDeployToS3', {
        installCommands: [`npm install -g @aws-amplify/cli@${AMPLIFY_VERSION}`],
        buildEnvironment: {
          privileged: true,
          computeType: codebuild.ComputeType.LARGE,
        },
        commands: [
          'aws cloudformation describe-stacks --stack-name ' +
            `drem-backend-${props.labelName}-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs`,

          // Generate Amplify configs for all three apps
          'python scripts/generate_amplify_config_cfn.py',
          'python scripts/generate_leaderboard_amplify_config_cfn.py',
          'python scripts/generate_stream_overlays_amplify_config_cfn.py',

          // Fetch GraphQL schema and run codegen for all three apps
          'appsyncId=`cat appsyncId.txt`',
          'aws appsync get-introspection-schema --api-id $appsyncId --format SDL ./website/src/graphql/schema.graphql',
          'cd ./website/src/graphql && amplify codegen && amplify codegen && cd ../../..',
          'aws appsync get-introspection-schema --api-id $appsyncId --format SDL ./website/leaderboard/src/graphql/schema.graphql',
          'cd ./website/leaderboard/src/graphql && amplify codegen && amplify codegen && cd ../../../..',
          'aws appsync get-introspection-schema --api-id $appsyncId --format SDL ./website/overlays/src/graphql/schema.graphql',
          'cd ./website/overlays/src/graphql && amplify codegen && amplify codegen && cd ../../../..',

          // Build leaderboard and overlays, copy into website/public/
          'docker run --rm -v $(pwd):/foo -w /foo/website/leaderboard' +
            " public.ecr.aws/sam/build-nodejs22.x:latest bash -c 'npm install --cache /tmp/empty-cache && npm run build'",
          'mkdir -p ./website/public/leaderboard && cp -r ./website/leaderboard/build/. ./website/public/leaderboard/',
          'docker run --rm -v $(pwd):/foo -w /foo/website/overlays' +
            " public.ecr.aws/sam/build-nodejs22.x:latest bash -c 'npm install --cache /tmp/empty-cache && npm run build'",
          'mkdir -p ./website/public/overlays && cp -r ./website/overlays/build/. ./website/public/overlays/',

          // Build main site (sub-apps already in public/)
          'docker run --rm -v $(pwd):/foo -w /foo/website' +
            " public.ecr.aws/sam/build-nodejs22.x:latest bash -c 'npm install --cache /tmp/empty-cache && npm run build'",

          // Sync everything and invalidate
          'aws s3 sync ./website/build/ s3://$sourceBucketName/ --delete',
          "aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*'",
        ],
        envFromCfnOutputs: {
          sourceBucketName: infrastructure.sourceBucketName,
          distributionId: infrastructure.distributionId,
        },
        rolePolicyStatements: rolePolicyStatementsForWebsiteDeployStages,
      })
    );

    pipeline.buildPipeline();
    const topic = new sns.Topic(this, 'PipelineTopic');
    topic.addSubscription(new subs.EmailSubscription(props.email));
    const rule = new notifications.NotificationRule(this, 'NotificationRule', {
      source: pipeline.pipeline,
      events: [
        'codepipeline-pipeline-pipeline-execution-started',
        'codepipeline-pipeline-pipeline-execution-failed',
        'codepipeline-pipeline-pipeline-execution-succeeded',
        'codepipeline-pipeline-manual-approval-needed',
      ],
      targets: [topic],
    });
    rule.node.addDependency(topic.node.findChild('Policy'));
  }
}
