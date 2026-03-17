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
  public readonly leaderboardDistributionId: cdk.CfnOutput;
  public readonly leaderboardSourceBucketName: cdk.CfnOutput;
  public readonly streamingOverlayDistributionId: cdk.CfnOutput;
  public readonly streamingOverlaySourceBucketName: cdk.CfnOutput;
  public readonly termAndConditionsDistributionId: cdk.CfnOutput;
  public readonly termAndConditionsSourceBucketName: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: InfrastructurePipelineStageProps) {
    super(scope, id, props);

    const baseStack = new BaseStack(this, 'base', {
      email: props.email,
      labelName: props.labelName,
      domainName: props.domainName,
    });
    const stack = new DeepracerEventManagerStack(this, 'infrastructure', {
      baseStackName: baseStack.stackName,
      cloudfrontDistribution: baseStack.cloudfrontDistribution,
      cloudfrontDomainNames: baseStack.cloudfrontDomainNames,
      tacCloudfrontDistribution: baseStack.tacCloudfrontDistribution,
      tacSourceBucket: baseStack.tacSourceBucket,
      logsBucket: baseStack.logsBucket,
      lambdaConfig: baseStack.lambdaConfig,
      adminGroupRole: baseStack.idp.adminGroupRole,
      operatorGroupRole: baseStack.idp.operatorGroupRole,
      commentatorGroupRole: baseStack.idp.commentatorGroupRole,
      registrationGroupRole: baseStack.idp.registrationGroupRole,
      authenticatedUserRole: baseStack.idp.authenticatedUserRole,
      userPool: baseStack.idp.userPool,
      identiyPool: baseStack.idp.identityPool,
      userPoolClientWeb: baseStack.idp.userPoolClientWeb,
      dremWebsiteBucket: baseStack.dremWebsitebucket,
      eventbus: baseStack.eventbridge.eventbus,
    });

    this.distributionId = stack.distributionId;
    this.sourceBucketName = stack.sourceBucketName;
    this.leaderboardSourceBucketName = stack.leaderboardSourceBucketName;
    this.leaderboardDistributionId = stack.leaderboardDistributionId;
    this.streamingOverlaySourceBucketName = stack.streamingOverlaySourceBucketName;
    this.streamingOverlayDistributionId = stack.streamingOverlayDistributionId;
    this.termAndConditionsSourceBucketName = stack.tacSourceBucketName;
    this.termAndConditionsDistributionId = stack.tacWebsitedistributionId;
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

    // Main website Deploy to S3
    infrastructure_stage.addPost(
      new pipelines.CodeBuildStep('MainSiteDeployToS3', {
        installCommands: [`npm install -g @aws-amplify/cli@${AMPLIFY_VERSION}`],
        buildEnvironment: {
          privileged: true,
          computeType: codebuild.ComputeType.LARGE,
        },
        commands: [
          // configure and deploy DREM website
          "echo 'Starting to deploy the DREM website'",
          'echo website bucket= $sourceBucketName',
          'aws cloudformation describe-stacks --stack-name ' +
            `drem-backend-${props.labelName}-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs`,
          'python scripts/generate_amplify_config_cfn.py',
          'appsyncId=`cat appsyncId.txt` && aws appsync' +
            ' get-introspection-schema --api-id $appsyncId --format SDL' +
            ' ./website/src/graphql/schema.graphql',
          'cd ./website/src/graphql',
          'amplify codegen', // this is on purpose
          'amplify codegen', // I'm not repeating myself ;)
          'cd ../..',
          'docker run --rm -v $(pwd):/foo -w /foo' +
            " public.ecr.aws/sam/build-nodejs22.x:latest bash -c 'npm install" +
            " --cache /tmp/empty-cache && npm run build'",
          'aws s3 sync ./build/ s3://$sourceBucketName/ --delete',
          'echo distributionId=$distributionId',
          "aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*'",
          'cd ..',
        ],
        envFromCfnOutputs: {
          sourceBucketName: infrastructure.sourceBucketName,
          distributionId: infrastructure.distributionId,
        },
        rolePolicyStatements: rolePolicyStatementsForWebsiteDeployStages,
      })
    );

    // Leaderboard website Deploy to S3
    infrastructure_stage.addPost(
      new pipelines.CodeBuildStep('LeaderboardDeployToS3', {
        installCommands: [`npm install -g @aws-amplify/cli@${AMPLIFY_VERSION}`],
        buildEnvironment: {
          privileged: true,
          computeType: codebuild.ComputeType.LARGE,
        },
        commands: [
          // configure and deploy Leaderboard website
          "echo 'Starting to deploy the Leaderboard website'",
          'echo website bucket= $leaderboardSourceBucketName',
          'aws cloudformation describe-stacks --stack-name ' +
            `drem-backend-${props.labelName}-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs`, // TODO add when paralazing the website deployments
          'python scripts/generate_amplify_config_cfn.py',
          'python scripts/generate_leaderboard_amplify_config_cfn.py',
          'appsyncId=`cat appsyncId.txt` && aws appsync' +
            ' get-introspection-schema --api-id $appsyncId --format SDL' +
            ' ./website-leaderboard/src/graphql/schema.graphql',
          'cd ./website-leaderboard/src/graphql',
          'amplify codegen', // this is on purpose
          'amplify codegen', // I'm not repeating myself ;)
          'cd ../..',
          'docker run --rm -v $(pwd):/foo -w /foo' +
            " public.ecr.aws/sam/build-nodejs22.x:latest bash -c 'npm install" +
            " --cache /tmp/empty-cache && npm run build'",
          'aws s3 sync ./build/ s3://$leaderboardSourceBucketName/ --delete',
          "aws cloudfront create-invalidation --distribution-id $leaderboardDistributionId --paths '/*'",
          'cd ..',
        ],
        envFromCfnOutputs: {
          leaderboardSourceBucketName: infrastructure.leaderboardSourceBucketName,
          leaderboardDistributionId: infrastructure.leaderboardDistributionId,
        },
        rolePolicyStatements: rolePolicyStatementsForWebsiteDeployStages,
      })
    );

    // Streaming overlay website Deploy to S3
    infrastructure_stage.addPost(
      new pipelines.CodeBuildStep('StreamingOverlayDeployToS3', {
        installCommands: [`npm install -g @aws-amplify/cli@${AMPLIFY_VERSION}`],
        buildEnvironment: {
          privileged: true,
          computeType: codebuild.ComputeType.LARGE,
        },
        commands: [
          // configure and deploy Streaming overlay website
          "echo 'Starting to deploy the Streaming overlay website'",
          'echo website bucket= $streamingOverlaySourceBucketName',
          'aws cloudformation describe-stacks --stack-name ' +
            `drem-backend-${props.labelName}-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs`, // TODO add when paralazing the website deployments
          'python scripts/generate_amplify_config_cfn.py',
          'python scripts/generate_stream_overlays_amplify_config_cfn.py',
          'appsyncId=`cat appsyncId.txt` && aws appsync' +
            ' get-introspection-schema --api-id $appsyncId --format SDL' +
            ' ./website-stream-overlays/src/graphql/schema.graphql',
          'cd ./website-stream-overlays/src/graphql',
          'amplify codegen', // this is on purpose
          'amplify codegen', // I'm not repeating myself ;)
          'cd ../..',
          'docker run --rm -v $(pwd):/foo -w /foo' +
            " public.ecr.aws/sam/build-nodejs22.x:latest bash -c 'npm install" +
            " --cache /tmp/empty-cache && npm run build'",
          'aws s3 sync ./build/ s3://$streamingOverlaySourceBucketName/ --delete',
          "aws cloudfront create-invalidation --distribution-id $streamingOverlayDistributionId --paths '/*'",
        ],
        envFromCfnOutputs: {
          streamingOverlaySourceBucketName: infrastructure.streamingOverlaySourceBucketName,
          streamingOverlayDistributionId: infrastructure.streamingOverlayDistributionId,
        },
        rolePolicyStatements: rolePolicyStatementsForWebsiteDeployStages,
      })
    );

    // Terms and Conditions website Deploy to S3
    infrastructure_stage.addPost(
      new pipelines.CodeBuildStep('TermsAndConditionsDeployToS3', {
        buildEnvironment: {
          privileged: false,
          computeType: codebuild.ComputeType.LARGE,
        },
        commands: [
          // configure and deploy Terms and Conditions website
          "echo 'Starting to deploy the Terms and Conditions website'",
          'echo website bucket= $sourceBucketName',
          'aws s3 sync ./website-terms-and-conditions/ s3://$sourceBucketName/ --delete',
          "aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*'",
        ],
        envFromCfnOutputs: {
          sourceBucketName: infrastructure.termAndConditionsSourceBucketName,
          distributionId: infrastructure.termAndConditionsDistributionId,
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
