<p align="center">
	<img src="./website/public/logo-bw.png" width="300"> 
</p>

# Welcome to AWS DeepRacer Event Manager (DREM)

## Overview

The AWS DeepRacer Event Manager (DREM) is used to run and manage all aspects of in-person events for AWS DeepRacer, an autonomous 1/18th scale race car designed to test reinforcement learning (RL) models by racing on a physical track.

DREM offers event organizers tools for managing users, models, cars and fleets, events, as well as time recording and leaderboards. Race participants also use DREM to upload their RL models.

### Architectural overview

<p align="center">
	<img src="./docs/images/DREM-aws-reference-architecture-overview.png"> 
</p>

**Note:** DREM is designed for use with AWS DeepRacer cars running firmware version 20.04 and above. Earlier firmware versions are not supported. If you need to update your device, see [Update and restore your AWS DeepRacer device](https://docs.aws.amazon.com/deepracer/"latest/developerguide/deepracer-ubuntu-update.html)

## Deployment

##### <span style="color:orange"> \* Optional: If you want to use a container that has everything you need to get started.</span>

With docker running on your machine, use the following commands to build and start the container. (or run `make local.docker.run`)

```sh
docker build --tag=deepracer-build-env:latest .
docker run --privileged -p 3000-3002:3000-3002 -d --mount type=bind,source=$(pwd),target=/deepracer-event-manager --name deepracer-build deepracer-build-env:latestdeepracer-build deepracer-build-env:latest
docker exec -it deepracer-build /bin/bash
```

Once in the container, check to make sure you see the files from the git repo.

```sh
ls -la
```

**Note:** Before running `make local.run` in the container to start DREM you will need to install the dependencies (`make local.install`) and config (`make local.config`) both commands should be run outside of the container on the host machine.

### Deployment prerequisites

The deployment requires the following tools:

- [Docker](https://www.docker.com/) with ARM build support
- [AWS CLI](https://aws.amazon.com/cli) <span style="color:orange">\*</span>
- [AWS CDK](https://aws.amazon.com/cdk/) with Typescript support (Tested with 2.6.0) <span style="color:orange">\*</span>
- [Node.js](https://nodejs.org) version 18.x <span style="color:orange">\*</span>
- (Optional) [Make](https://www.gnu.org/software/make/) buildtool. We provide a Makefile with all required targets for easy use. We recommend installing Make. <span style="color:orange">\*</span>

<span style="color:orange">\* Included if you use docker the container above</span>

### Supported regions

The deployment is currently supported in theses regions:

    US East (N. Virginia)
    US East (Ohio)
    US West (Oregon)
    Europe (Frankfurt)
    Europe (Stockholm)
    Europe (Ireland)
    Europe (London)
    Asia Pacific (Tokyo)
    Asia Pacific (Singapore)
    Asia Pacific (Sydney)

**Note:** If you experience cross platform emulation issues with Docker then `docker run --privileged --rm tonistiigi/binfmt --install all` can help resolve some issues.

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

#### Step 1: Setup environment and create S3 bucket and enable versioning

```sh
#Bucket used to put deep racer event manager assets
export BUCKET=<your-resource-bucket-name>
#Region where you wish to deploy
export REGION=<your-region>
#Your e-mail
export EMAIL=<your-email>

#Optional if you have AWS CLI configured with you credentials already.
export AWS_ACCESS_KEY_ID=<key>
export AWS_SECRET_ACCESS_KEY=<secret>
export AWS_SESSION_TOKEN=<token>

#Setting variables we can do automatically.
export BRANCH=$(git symbolic-ref --short HEAD)
export ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

```

```sh
#Bucket creation
aws s3 mb s3://$BUCKET --region $REGION
#Versioning activation on the bucket
aws s3api put-bucket-versioning --bucket $BUCKET --versioning-configuration Status=Enabled
```

#### Step 2: Create a Parameter Store key

```sh
aws ssm put-parameter --name /drem/S3RepoBucket --value arn:aws:s3:::$BUCKET --type String --region $REGION
```

#### Step 3: Install build dependencies

```sh
npm install
```

#### Step 4: Create the build config for Make

Note. This step is only required if Make is used for the later steps.

Build your `build.config` file

```sh
echo "region=$REGION" >> build.config
echo "email=$EMAIL" >> build.config
echo "account_id=$ACCOUNT" >> build.config
echo "branch=$BRANCH" >> build.config
```

#### Step 5: Bootstrap AWS CDK

In this step, you bootstrap the CDK. Two options are listed below.

##### Using make

```sh
make bootstrap
```

##### Manually

```sh
cdk bootstrap -c email=$EMAIL -c account=$ACCOUNT -c region=$REGION -c branch=$BRANCH
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
aws s3 cp drem.zip s3://$(aws ssm get-parameter --name '/drem/S3RepoBucket' --output text --query 'Parameter.Value' --region $REGION| cut -d ':' -f 6)/<branch>/)
```

Deploy

```sh
npx cdk deploy -c email=<admin-email> -c account=1234567890 -c region=<optional> -c branch=<optional>
```

#### Step 7: Accessing DREM

The deployment of DREM through the pipeline will take approximately 1 hour. You can monitor the progress of the deployment by accessing the AWS Account you are deploying DREM into and going into AWS CodePipeline and reviewing the pipeline. As part of the deployment, the email address provided will become the admin user for DREM. An email with temporary credentials to access DREM as well as the a link will be sent to the email address provided. **Note:** The link won't work until the codepipeline has fully finished. When logging in for first time, the username is `admin` and the user will be prompted to change the temporary password.

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
npx cdk destroy -c email=$EMAIL -c account=$ACCOUNT -c region=$REGION -c branch=$BRANCH
```

### Step 2: Remove the infrastructure stack

#### Using make

```sh
make drem.clean-infrastructure
```

#### Manually

```sh
aws cloudformation delete-stack --stack-name drem-backend-$BRANCH-infrastructure --REGION $REGION
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
aws ssm delete-parameter --name /drem/S3RepoBucket --region $REGION
```

## Sample models

DREM has sample models trained used the reward functions in the AWS DeepRacer console that are available to load on to cars at events.

- AtoZ Speedway clockwise
  - AtoZ-CW-Centerline-tracking.tar.gz
  - AtoZ-CW-Steering-penalty.tar.gz
  - AtoZ-CW-Throttle-penalty.tar.gz
- AtoZ Speedway counter clockwise
  - AtoZ-CCW-Centerline-tracking.tar.gz
  - AtoZ-CCW-Steering-penalty.tar.gz
  - AtoZ-CCW-Throttle-penalty.tar.gz

They were trained for 12 hours using the PPO training algorithm, default discrete action space and the Hyperparameters:

- Gradient descent batch size: 64
- Number of epochs: 10
- Learning rate: 0.0003
- Entropy: 0.01
- Discount factor: 0.95
- Loss type: Huber
- Number of experience episodes between each policy-updating iteration: 20

These models can be found in `lib/default_models`

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE.md) file.
