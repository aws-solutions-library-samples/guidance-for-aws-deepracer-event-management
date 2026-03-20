import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CdkPipelineStack } from '../lib/cdk-pipeline-stack';

test('Pipeline stack synthesizes with a CodePipeline resource', () => {
  const app = new cdk.App();
  const stack = new CdkPipelineStack(app, 'TestPipelineStack', {
    labelName: 'test',
    sourceRepo: 'aws-solutions-library-samples/guidance-for-aws-deepracer-event-management',
    sourceBranchName: 'main',
    email: 'test@example.com',
    env: { account: '123456789012', region: 'eu-west-2' },
  });

  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
});
