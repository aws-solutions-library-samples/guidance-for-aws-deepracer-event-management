<p align="center">
	<img src="./website/public/logo-bw.png" width="300"> 
</p>

# Welcome to DeepRacer Event Manager (DREM)

## Overview

The AWS DeepRacer Event Manager (DREM) is used to run and manage all aspects of in-person events for AWS DeepRacer, an autonomous 1/18th scale race car designed to test reinforcement learning (RL) models by racing on a physical track.

DREM offers event organizers tools for managing users, models, cars and fleets, events, as well as time recording and leaderboards. Race participants also use DREM to upload their RL models.

### Architectural overview

<p align="center">
	<img src="./docs/images/DREM-aws-reference-architecture-overview.png"> 
</p>

**Note:** DREM is designed for use with AWS DeepRacer cars running firmware version 20.04 and above. Earlier firmware versions are not supported. If you need to update your device, see [Update and restore your AWS DeepRacer device](https://docs.aws.amazon.com/deepracer/"latest/developerguide/deepracer-ubuntu-update.html)

## Deployment

### Deployment prerequisites

The deployment requires the following tools:

- [AWS CLI](https://aws.amazon.com/cli)
- [AWS CDK](https://aws.amazon.com/cdk/) with Typescript support (Tested with 2.6.0)
- [Docker](https://www.docker.com/) with ARM build support
- [Node.js](https://nodejs.org) version 18.x
- (Optional) Make buildtool. We provide a Makefile with all required targets for easy use. We recommend installing Make.

### Deployment overview

Please note: It takes approximately an hour for all of the DREM resources to be deployed.

1. Create an S3 bucket to act as the source for the codepipeline **_The bucket must have versioning enabled_**
2. Create a Parameter Store key called '/drem/S3RepoBucket' with a string value of the S3 Bucket ARN for the codepipeline source, for example, `arn:aws:s3:::drem-pipeline-zip-123456789012-eu-west-1`
3. Install build dependencies
4. Create required build.config (if using Make)
5. Bootstrap AWS CDK
6. Install DREM
7. Accessing DREM
8. Setup Amazon Cognito to use Amazon SES for email sending (optional)

### Option 1. Deploy DREM for use at an event

If you are deploying DREM for use to support your AWS DeepRacer event(s)

#### Step 1: Create S3 bucket and enable versioning

```sh
aws s3 mb s3://<your-resource-bucket-name>
aws s3api put-bucket-versioning --bucket <your-resource-bucket-name> --versioning-configuration Status=Enabled
```

#### Step 2: Create a Parameter Store key

```sh
aws ssm put-parameter --name /drem/S3RepoBucket --value arn:aws:s3:::<your-resource-bucket-name> --type String
```

#### Step 3: Install build dependencies

```sh
npm install
```

#### Step 4: Create the build config for Make

Note. This step is only required if Make is used for the later steps.

Copy and rename the example `build.config.example` file

```sh
cp build.config.example build.config
```

And update as appropriate with your details

```sh
email=<Admin email>
account_id=<Account id>
region=<optional to define the install region. Default: eu-west-1>
branch=<optional is used to install more than one DREM in the same account. Default: main>
```

#### Step 5: Bootstrap AWS CDK

In this step, you bootstrap the CDK. Two options are listed below.

##### Using make

```sh
make bootstrap
```

##### Manually

```sh
cdk bootstrap -c email=<admin-email> -c account=1234567890 -c region=<optional> -c branch=<optional>
```

### Step 6: Install DREM

This command uploads all required files into the specified S3 bucket and then creates a CodePipeline pipeline. This pipeline coordinates the build and deployment of all required DREM services.

##### Using make

Deploy

```sh
make install
```

##### Manually

Create a zip of DREM

```sh
zip -r drem.zip . -x ./.venv/\* ./.git/\* ./website/build/\* ./website/node_modules/\* ./node_modules/\* ./cdk.out/\* ./website-leaderboard/build/\* ./website-leaderboard/node_modules/\* ./website-stream-overlays/build/\* ./website-stream-overlays/node_modules/\*
```

Copy `drem.zip` to the S3 bucket created earlier using the key in parameter store for the bucket name subsituting `<branch>` for the branch name (usually `main`)

```sh
aws s3 cp drem.zip s3://$(aws ssm get-parameter --name '/drem/S3RepoBucket' --output text --query 'Parameter.Value' | cut -d ':' -f 6)/<branch>/)
```

Deploy

```sh
npx cdk deploy -c email=<admin-email> -c account=1234567890 -c region=<optional> -c branch=<optional>
```

#### Step 7: Accessing DREM

The deployment of DREM through the pipeline will take approximately 1 hour. As part of the deployment, the email address provided will become the admin user for DREM. An email with temporary credentials to access DREM as well as the a link will be sent to the email address provided. When logging in for first time, the user will be prompted to change the temporary password.

#### Step 8: Setup Amazon Cognito to use Amazon SES for email sending (optional)

In the default configuration Amazon Cognito only supports 50 signups a day due to a hard limit on the number of signup emails it is allowed to send. To resolve this you must enable the [integration with Amazon SES](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html).

To manually enable this integration, you can follow these steps:

1. `Purchase/Register` your domain in `Route 53 `
   - you can use other DNS providers but those steps are not detailed here
2. `Add the domain` to the verified identities in `Amazon SES`
3. Take the SES account out of [sandbox mode](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
4. Navigate to your `Amazon Cognito User Pool`
5. Click `Edit` in `Messaging, Email`
6. Switch the configuration to `Send email with Amazon SES` and complete the rest of the email configuration appropriately
7. Click `Save changes`

### Option 2. Deploy DREM as a developer / contributor

### Development prequisities

As per the deployment prerequisites with the following additional tools

- [GIT](https://git-scm.com/)
- [Visual Studio Code](https://code.visualstudio.com/)
- Python3

A number of plugins are recommended when contributing code to DREM. VSCode will prompt you to install these plugins when you open the source code for the first time.

We recommend that you use the Makefile based commands to simplify the steps required when developing code for DREM.

If you plan to help develop DREM and contribute code, the inital deployment of DREM is the same as above. Once DREM has deployed, to make the deployed DREM stack available for local development, run the following commands:

#### Install local dependancies

```sh
make local.install
```

#### Configure the local development enviroment

**Note:** You will need to have your local development environment setup to access AWS

```sh
make local.config
```

#### Run the frontend locally

To run the main DREM application

```sh
make local.run
```

To run the DREM leaderboard application

```sh
make local.run-leaderboard
```

To run the DREM streaming overlays

```sh
make local.run-overlays
```

### Cleanup

When you have finshed using DREM for your event, the application can be removed using either Makefile based commands or manually.

### Step 1: Remove the pipeline

#### Using make

```sh
make clean
```

#### Manually

```sh
npx cdk destroy -c email=<admin-email> -c account=1234567890 -c region=<optional> -c branch=<optional>
```

### Step 2: Remove the infrastructure stack

#### Using make

```sh
make drem.clean-infrastructure
```

#### Manually

```sh
aws cloudformation delete-stack --stack-name drem-backend-<branch-name>-infrastructure
```

#### Manual clean up

Not all of the elements from the stack are able to be deleted in an automated manner and so once the initial attempt at deleting the stack has failed with `DELETE_FAILED` status you need to manually delete the stack using the console and retain the resources that can't be automatically delete. Once the stack has been deleted the retained resources can be manually deleted

`ModelsManagerClamScanVirusDefsBucketPolicy*`

(Known issue - we are looking to resolve this with an updated version of how we use ClamScanAV within DREM)

### Step 3: Remove the base stack

#### Using make

```sh
make drem.clean-base
```

#### Manually

```sh
aws cloudformation delete-stack --stack-name drem-backend-<branch-name>-base
```

#### Mannual clean up

Not all of the elements from the stack are able to be deleted in an automated manner and so once the initial attempt at deleting the stack has failed with `DELETE_FAILED` status you need to manually delete the stack using the console and retain the resources that can't be automatically delete. Once the stack has been deleted the retained resources can be manually deleted

`logsBucket*`

### Step 4: Remove S3 deployment bucket

Using the console remove the S3 bucket created in step 1 of deploying DREM.

### Step 5: Remove SSM parameter

```sh
aws ssm delete-parameter --name /drem/S3RepoBucket
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE.md) file.

---

# DREM DEV (OLD NOTES)

## Translations

Are you creating a version of DREM in another language ?

Translation files:

- DREM language strings - [translation.json](./website/public/locales/en/translation.json)
- DREM help panels - []()
- DREM leaderboards - [translation.json](./website-leaderboard/public/locales/en/translation.json)

## Prerequisites

- [Docker Desktop](https://www.docker.com/)
- [Python](https://www.python.org/) (Tested with 3.9.10)
- [AWS CDK](https://aws.amazon.com/cdk/) (Tested with 2.6.0)

## Pipeline Deploy (via Gitlab)

- Gitlab builds the zipfile and uploads it to the DREM Dev Account (dasmthc+deepracer@amazon.com)

### General Information:

Gitlab builds the Zipfile from the repo and uploads it to the DREM Dev Account (dasmthc+deepracer@amazon.com).
A new file in the S3 Bucket then triggers the pipeline in that account. That pipeline builds the Backend end Frontend.

### Prerequisites

- Have at least Maintainer Role in the Gitlab Project to make the Branch a `protected` Branch
- Access to the DREM Dev Account (`dasmthc+deepracer@amazon.com`)

### Deploy

1. Protect the branch through GitLab -> Settings -> [Repository](https://gitlab.aws.dev/dasmthc/deepracer-event-manager/-/settings/repository)
2. Add the branch name to `.gitlab-ci.yml` in both `zip_repo: -> only`: and also `upload_to_s3: -> only: sections`. Push these changes to gitlab. (That is required to let Gitlab build the zip and uploading it to the DREM Dev Account)
3. `echo "branch-name" > branch.txt`
4. `echo "email@domain.com" > email.txt` for the admin email address
5. Run `make pipeline.deploy` from local to "bootstrap" the cdk pipeline for the users branch
6. Once the pipeline is in place push a change via a git and the code pipeline will then build and deploy into your account

## Pipeline Deploy (without Gitlab)

!!! When you build with gitlab and via a local file. The e-mail in `email.txt`must match `drem-developers@amazon.co.uk`. Otherwise the build will fail because the default admin user must then be changed.

1. Create an S3 bucket to act as source for the codepipeline **_That bucket must have versioning enabled_**
2. Create a Parameter Store Key called '/drem/S3RepoBucket' with a string value of the S3 Bucket ARN for the codepipeline source e.g. 'arn:aws:s3:::drem-pipeline-zip-123456789012-eu-west-1'.
3. `echo "branch-name" > branch.txt`
4. `echo "email@domain.com" > email.txt` for the admin email address
5. `echo "drem-pipeline-zip-123456789012-eu-west-1" > s3_bucket.txt`
6. Run `make pipeline.deploy` from local to "bootstrap" the code pipeline for the users branch

The pipeline will fail in the beginning because no zipfile with the repository is available in the configured S3 Bucket.
For uploading the repository as zipfile you can use also make.

```
$ make pipeline.trigger
```

## Local Frontend

1. Run `make local.config` to build the local config from the CloudFormation stack and create the GraphQL schema
2. Run `make local.install` to install the internet
3. Run `make local.run` to run the frontend locally

## Setup development environment

### Setup pre commit hooks

- install dependencies `$ npm install `
- install pre-commit hooks`$ pip install pre-commit && pre-commit install`
- set `AWS_DEFAULT_REGION`
- set `CDK_DEFAULT_ACCOUNT`

The pre-commit hooks will only run towards changed files. You can manually run a pre-commit hook test without committing the files by running `bash .git/hooks/pre-commit`

## SES + Cognito

[Setup Guide](./docs/SES.md)
