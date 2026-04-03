import * as cdk from 'aws-cdk-lib';
import { Aspects, Duration, Environment, RemovalPolicy, Stage } from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as notifications from 'aws-cdk-lib/aws-codestarnotifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as customResources from 'aws-cdk-lib/custom-resources';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
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
  public readonly dremWebsiteUrl: cdk.CfnOutput;
  public readonly appsyncId: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: InfrastructurePipelineStageProps) {
    super(scope, id, props);

    // Ensure cdk-nag visits stacks inside this Stage during pipeline synth
    Aspects.of(this).add(new AwsSolutionsChecks({ verbose: true }));

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
    this.dremWebsiteUrl = stack.dremWebsiteUrl;
    this.appsyncId = stack.appsyncId;
  }
}
export interface CdkPipelineStackProps extends cdk.StackProps {
  labelName: string;
  sourceRepo: string;
  sourceBranchName: string;
  email: string;
  env: Environment;
  domainName?: string;
  requireApproval?: boolean;
}

export class CdkPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkPipelineStackProps) {
    super(scope, id, props);

    // setup for pseudo parameters
    const stack = cdk.Stack.of(this);

    const artifactBucket = new s3.Bucket(this, 'PipelineArtifactsBucket', {
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      artifactBucket,
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
          // CDK infrastructure tests only — website tests run in a separate
          // pipeline step (WebsiteTests) so the synth always produces cdk.out.
          // This is critical for self-mutation: if website tests were here and
          // failed (e.g. after a directory restructure), the pipeline could
          // never update itself.
          'npm test',
          `npx cdk@${CDK_VERSION} synth --all -c email=${props.email} -c label=${props.labelName}` +
            ` -c account=${props.env.account} -c region=${props.env.region}` +
            ` -c source_branch=${props.sourceBranchName} -c source_repo=${props.sourceRepo}` +
            (props.domainName ? ` -c domain_name=${props.domainName}` : '') +
            (props.requireApproval === false ? ` -c require_approval=false` : ''),
        ],
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          reports: {
            jest_reports: {
              files: ['junit-cdk.xml'],
              'base-directory': 'reports',
              'file-format': 'JUNITXML',
            },
          },
        }),
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

    // Website unit tests — run as a pre-deploy gate on the infrastructure stage.
    // Kept separate from synth so directory restructures (e.g. website
    // consolidation) can't block cdk.out generation and pipeline self-mutation.
    // `--legacy-peer-deps` is required because avataaars@2 declares a React 17
    // peer while DREM uses React 18.
    const websiteTestStep = new pipelines.CodeBuildStep('WebsiteTests', {
      buildEnvironment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
        computeType: codebuild.ComputeType.LARGE,
      },
      installCommands: [`n ${NODE_VERSION}`, 'node --version'],
      commands: [
        'npm install',
        'cd website && npm install --legacy-peer-deps && npm test && cd ..',
        'cd website/leaderboard && npm install --legacy-peer-deps && npm test && cd ../..',
        'cd website/overlays && npm install --legacy-peer-deps && npm test && cd ../..',
      ],
      partialBuildSpec: codebuild.BuildSpec.fromObject({
        reports: {
          website_test_reports: {
            files: ['junit-website.xml', 'junit-leaderboard.xml', 'junit-overlays.xml'],
            'base-directory': 'reports',
            'file-format': 'JUNITXML',
          },
        },
      }),
    });

    // Manual approval depends on WebsiteTests so the approval notification
    // doesn't appear until tests pass — otherwise the two ran in parallel and
    // a deploy could be approved before tests had even started.
    // requireApproval defaults to true. Set requireApproval=false in build.config
    // to skip the manual approval gate (handy for fork dev environments).
    const requireApproval = props.requireApproval !== false;
    const approvalStep = new pipelines.ManualApprovalStep('DeployDREM');
    if (requireApproval) {
      approvalStep.addStepDependency(websiteTestStep);
    }

    const infrastructure_stage = pipeline.addStage(infrastructure, {
      pre: requireApproval ? [websiteTestStep, approvalStep] : [websiteTestStep],
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

    // Deploy all three websites (main + leaderboard + overlays) to S3 in a single step.
    // Kept as a const so the post-deploy test step can take a dependency on it.
    const websiteDeployStep = new pipelines.CodeBuildStep('WebsiteDeployToS3', {
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
          " public.ecr.aws/sam/build-nodejs22.x:latest bash -c 'npm install --cache /tmp/empty-cache --legacy-peer-deps && npm run build'",
        'mkdir -p ./website/public/leaderboard && cp -r ./website/leaderboard/build/. ./website/public/leaderboard/',
        'docker run --rm -v $(pwd):/foo -w /foo/website/overlays' +
          " public.ecr.aws/sam/build-nodejs22.x:latest bash -c 'npm install --cache /tmp/empty-cache --legacy-peer-deps && npm run build'",
        'mkdir -p ./website/public/overlays && cp -r ./website/overlays/build/. ./website/public/overlays/',

        // Copy pico-display Python files to website/public/ for OTA
        'mkdir -p ./website/public/pico-display',
        'cp pico-display/main.py pico-display/config.py pico-display/display.py pico-display/leaderboard.py pico-display/race.py pico-display/state.py pico-display/wifi.py pico-display/ota.py ./website/public/pico-display/',

        // Build main site (sub-apps already in public/)
        'docker run --rm -v $(pwd):/foo -w /foo/website' +
          " public.ecr.aws/sam/build-nodejs22.x:latest bash -c 'npm install --cache /tmp/empty-cache --legacy-peer-deps && npm run build'",

        // Sync everything and invalidate
        'aws s3 sync ./website/build/ s3://$sourceBucketName/ --delete',
        "aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*'",
      ],
      envFromCfnOutputs: {
        sourceBucketName: infrastructure.sourceBucketName,
        distributionId: infrastructure.distributionId,
      },
      rolePolicyStatements: rolePolicyStatementsForWebsiteDeployStages,
    });
    infrastructure_stage.addPost(websiteDeployStep);

    // Post-deploy tests — run after MainSiteDeployToS3 completes
    const postDeployStep = new pipelines.CodeBuildStep('PostDeployTests', {
      buildEnvironment: {
        computeType: codebuild.ComputeType.SMALL,
      },
      installCommands: [`n ${NODE_VERSION}`, 'node --version', 'npx playwright install --with-deps chromium'],
      commands: [
        'npm install',
        'aws appsync get-introspection-schema --api-id $appsyncId --format SDL website/src/graphql/schema.graphql',
        // Root postinstall is gated to skip on CodeBuild ($CODEBUILD_BUILD_ID is set),
        // so install website/ deps explicitly before running its npm scripts.
        // `--legacy-peer-deps` for the avataaars@2 React 17 peer.
        'cd website && npm install --legacy-peer-deps && npm run test:post-deploy && cd ..',
      ],
      envFromCfnOutputs: {
        appsyncId: infrastructure.appsyncId,
        DREM_WEBSITE_URL: infrastructure.dremWebsiteUrl,
      },
      rolePolicyStatements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['appsync:GetIntrospectionSchema'],
          resources: ['*'],
        }),
      ],
      partialBuildSpec: codebuild.BuildSpec.fromObject({
        reports: {
          post_deploy_reports: {
            files: ['junit-post-deploy.xml'],
            'base-directory': 'reports',
            'file-format': 'JUNITXML',
          },
        },
      }),
    });
    postDeployStep.addStepDependency(websiteDeployStep);
    infrastructure_stage.addPost(postDeployStep);

    pipeline.buildPipeline();

    // The pipeline artifact bucket (created above with SSL + encryption +
    // block-public-access) defaults to RemovalPolicy RETAIN, so
    // `drem-pipeline-<label>-pipelineartifactsbucket-*` is orphaned every
    // time the pipeline stack is deleted (the bucket is also non-empty by
    // then). Flip it to DESTROY and wire a small custom resource that
    // empties it on stack delete. The bucket only holds CodePipeline build
    // artifacts — no user data — so dropping it is safe.
    artifactBucket.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const bucketEmptier = new lambda.Function(this, 'PipelineArtifactBucketEmptier', {
      description: 'Empty the CDK Pipelines artifact bucket on stack delete',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      timeout: Duration.minutes(5),
      memorySize: 256,
      code: lambda.Code.fromInline(`
import boto3
s3 = boto3.client("s3")

def handler(event, context):
    if event.get("RequestType") != "Delete":
        return {}
    bucket = event["ResourceProperties"]["BucketName"]
    paginator = s3.get_paginator("list_object_versions")
    for page in paginator.paginate(Bucket=bucket):
        keys = []
        for v in page.get("Versions", []) + page.get("DeleteMarkers", []):
            keys.append({"Key": v["Key"], "VersionId": v["VersionId"]})
        if keys:
            s3.delete_objects(Bucket=bucket, Delete={"Objects": keys, "Quiet": True})
    return {}
`),
    });
    artifactBucket.grantReadWrite(bucketEmptier);
    bucketEmptier.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucketVersions'],
        resources: [artifactBucket.bucketArn],
      })
    );

    const bucketEmptierProvider = new customResources.Provider(this, 'PipelineArtifactBucketEmptierProvider', {
      onEventHandler: bucketEmptier,
    });

    new cdk.CustomResource(this, 'PipelineArtifactBucketEmptierCustomResource', {
      serviceToken: bucketEmptierProvider.serviceToken,
      properties: {
        BucketName: artifactBucket.bucketName,
      },
    });

    // cdk-nag suppressions for the emptier Lambda + the CDK Provider's
    // framework Lambda. Both use the AWS-managed AWSLambdaBasicExecutionRole
    // applied by default by the Lambda L2 construct, and the framework
    // Lambda's runtime is pinned by aws-cdk-lib/custom-resources. We can't
    // control either without restating the same permissions or forking
    // the construct.
    NagSuppressions.addResourceSuppressions(
      bucketEmptier,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason:
            'AWSLambdaBasicExecutionRole is the default Lambda execution role; replacing it would restate the same permissions.',
          appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
        },
        {
          id: 'AwsSolutions-L1',
          reason:
            'PYTHON_3_12 is the latest stable Lambda runtime supported by the CDK version in use; bump when CDK exposes a newer Python.',
        },
      ],
      true
    );
    NagSuppressions.addResourceSuppressions(
      bucketEmptierProvider,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Provider framework Lambda uses CDK-managed AWSLambdaBasicExecutionRole.',
          appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
        },
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'Provider framework Lambda needs lambda:InvokeFunction on the onEvent handler; CDK wildcards the function version arn.',
        },
        {
          id: 'AwsSolutions-L1',
          reason:
            'Provider framework Lambda runtime is pinned by aws-cdk-lib/custom-resources and cannot be controlled here.',
        },
      ],
      true
    );

    // Suppress cdk-nag findings for CDK Pipelines-managed resources we don't control
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions are managed by CDK Pipelines for CodeBuild and asset publishing roles',
      },
      {
        id: 'AwsSolutions-CB4',
        reason: 'KMS encryption for CodeBuild projects is managed by CDK Pipelines',
      },
      {
        id: 'AwsSolutions-S1',
        reason:
          'Access logging for the pipeline artifacts bucket is not required for this internal CI/CD artifact store.',
      },
      {
        id: 'AwsSolutions-SNS3',
        reason: 'SSL enforcement on the pipeline notification topic is not exposed by CDK Pipelines',
      },
    ]);

    const topicKey = new kms.Key(this, 'PipelineTopicKey', {
      enableKeyRotation: true,
      description: 'KMS key for pipeline notification SNS topic',
    });
    const topic = new sns.Topic(this, 'PipelineTopic', {
      masterKey: topicKey,
    });
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
