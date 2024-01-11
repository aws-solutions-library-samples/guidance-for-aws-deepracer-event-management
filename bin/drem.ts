#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
// import { App, Aspects } from 'aws-cdk-lib';
// import { AwsSolutionsChecks } from 'cdk-nag';
import { BaseStack } from '../lib/base-stack';
import { CdkPipelineStack } from '../lib/cdk-pipeline-stack';
import { DeepracerEventManagerStack } from '../lib/drem-app-stack';

const app = new App();
// Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

let accountId = process.env['CDK_DEFAULT_ACCOUNT'];

if (accountId === undefined) {
  if (app.node.tryGetContext('account') === undefined) {
    console.error(
      `No account specified please set CDK_DEFAULT_ACCOUNT environment variable define it in cdk.json file or via -c account`
    );
    process.exit(-1);
  } else {
    accountId = app.node.tryGetContext('account');
    console.info('Account Name: ' + accountId);
  }
}

let regionName = app.node.tryGetContext('region');
if (regionName) {
  console.info('Install in provided Region: ' + regionName);
} else {
  regionName = 'eu-west-1';
  console.info('Region not provided, using default: ' + regionName);
}

const env = { account: accountId, region: regionName };

const mailAddress = app.node.tryGetContext('email');
if (mailAddress) {
  console.info('Email Name: ' + mailAddress);
} else {
  console.info('Email Name: ' + mailAddress);
  console.error(`email context variable does not exist please define it in cdk.json file or via -c email`);
  process.exit(-1);
}

let labelName = app.node.tryGetContext('branch');
if (labelName) {
  console.info('Use provided Branch Name: ' + labelName);
} else {
  labelName = 'main';
  console.info('Label Name not provided, using default: ' + labelName);
}

let sourceBranchName = app.node.tryGetContext('source_branch');
if (sourceBranchName) {
  console.info('Use provided Source_Branch Name: ' + sourceBranchName);
} else {
  sourceBranchName = 'main';
  console.info('Branch Name not provided, using default: ' + sourceBranchName);
}

if (app.node.tryGetContext('manual_deploy') === 'True') {
  console.info('Manual Deploy started....');

  // Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
  const baseStack = new BaseStack(app, `drem-backend-${labelName}-base`, {
    email: mailAddress,
    labelName: labelName,
    env: env,
  });

  new DeepracerEventManagerStack(app, `drem-backend-${labelName}-infrastructure`, {
    baseStackName: baseStack.stackName,
    cloudfrontDistribution: baseStack.cloudfrontDistribution,
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
    env: env,
  });
} else {
  console.info('Pipeline deploy started...');
  new CdkPipelineStack(app, `drem-pipeline-${labelName}`, {
    labelName: labelName,
    sourceBranchName: sourceBranchName,
    email: mailAddress,
    env: env,
  });
}
