#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import * as fs from 'fs';

import 'source-map-support/register';
import { BaseStack } from '../lib/base-stack';
import { DeepracerEventManagerStack } from '../lib/drem-app-stack';


const env = { account: process.env["CDK_DEFAULT_ACCOUNT"], region:"eu-west-1" }

const branchFileName = "branch.txt"
let branchName
if (fs.existsSync(branchFileName)) {
  branchName = fs.readFileSync(branchFileName).toString()
  console.info("Branch Name: " + branchName)
}
else {
  console.error( `${branchFileName} does not exist, please create and populate with the branch name you are working on.`)
  process.exit(-1)
}


const emailfileName = "email.txt"
let email
if (fs.existsSync(emailfileName)) {
  email = fs.readFileSync(emailfileName).toString()
  console.info("Email Name: " + email)
}
else {
  console.error(`${emailfileName} does not exist, please create and populate with the admin email address.`)
  process.exit(-1)
}

const app = new App();

if (app.node.tryGetContext("manual_deploy") == "True") {
  console.info('Manual Deploy started....')

  const baseStack = new BaseStack(app, `DremBase-${branchName}`, {
    email: email
  })

  new DeepracerEventManagerStack(app, `DremInfrastructure-${branchName}`, {
    cloudfrontDistribution: baseStack.cloudfrontDistribution,
    logsBucket: baseStack.logsBucket,
    lambdaConfig: baseStack.lambdaConfig,
    adminGroupRole: baseStack.idp.adminGroupRole,
    operatorGroupRole: baseStack.idp.operatorGroupRole,
    authenticatedUserRole: baseStack.idp.authenticatedUserRole,
    userPool: baseStack.idp.userPool,
    identiyPool: baseStack.idp.identityPool,
    userPoolClientWeb: baseStack.idp.userPoolClientWeb,
    dremWebsiteBucket: baseStack.dremWebsitebucket
  });
}
else {
  console.info("Pipeline deploy started...")

  // new DremPipelineStack(
  //   app, "drem-pipeline-" + branchName, {
  //     branchName: branchName,
  //     email: email,
  //     env: env
  //    }
  // )
}
