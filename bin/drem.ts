#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
// import { App, Aspects } from 'aws-cdk-lib';
// import { AwsSolutionsChecks } from 'cdk-nag';
import * as fs from 'fs';
import { BaseStack } from '../lib/base-stack';
import { CdkPipelineStack } from '../lib/cdk-pipeline-stack';
import { DeepracerEventManagerStack } from '../lib/drem-app-stack';

const env = { account: process.env['CDK_DEFAULT_ACCOUNT'], region: 'eu-west-1' };

const branchFileName = 'branch.txt';
let branchName;
if (fs.existsSync(branchFileName)) {
    branchName = fs.readFileSync(branchFileName).toString().trim();
    console.info('Branch Name: ' + branchName);
} else {
    console.error(
        `${branchFileName} does not exist, please create and populate with the branch name you are working on.`
    );
    process.exit(-1);
}

const emailfileName = 'email.txt';
let email;
if (fs.existsSync(emailfileName)) {
    email = fs.readFileSync(emailfileName).toString().trim();
    console.info('Email Name: ' + email);
} else {
    console.error(
        `${emailfileName} does not exist, please create and populate with the admin email address.`
    );
    process.exit(-1);
}

const app = new App();
// Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

if (app.node.tryGetContext('manual_deploy') === 'True') {
    console.info('Manual Deploy started....');

    const baseStack = new BaseStack(app, `drem-backend-${branchName}-base`, {
        email: email,
        env: env,
    });

    new DeepracerEventManagerStack(app, `drem-backend-${branchName}-infrastructure`, {
        branchName: branchName,
        cloudfrontDistribution: baseStack.cloudfrontDistribution,
        tacCloudfrontDistribution: baseStack.tacCloudfrontDistribution,
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
    new CdkPipelineStack(app, `drem-pipeline-${branchName}`, {
        branchName: branchName,
        email: email,
        env: env,
    });
}
