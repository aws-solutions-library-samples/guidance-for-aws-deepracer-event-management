# Welcome to DeepRacer Event Manager (DREM)

## PreReqs

-   [Docker Desktop](https://www.docker.com/)
-   [Python](https://www.python.org/) (Tested with 3.9.10)
-   [AWS CDK](https://aws.amazon.com/cdk/) (Tested with 2.6.0)

## Pipeline Deploy (via Gitlab)

-   Gitlab builds the zipfile and uploads it to the DREM Dev Account (dasmthc+deepracer@amazon.com)

### General Information:

Gitlab builds the Zipfile from the repo and uploads it to the DREM Dev Account (dasmthc+deepracer@amazon.com).
A new file in the S3 Bucket then triggers the pipeline in that account. That pipeline builds the Backend end Frontend.

### PreReqs

-   Have at least Maintainer Role in the Gitlab Project to make the Branch a `protected` Branch
-   Access to the DREM Dev Account (`dasmthc+deepracer@amazon.com`)

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

-   install dependencies `$ npm install `
-   install pre-commit hooks`$ pip install pre-commit && pre-commit install`
-   set `AWS_DEFAULT_REGION`
-   set `CDK_DEFAULT_ACCOUNT`

The pre-commit hooks will only run towards changed files. You can manually run a pre-commit hook test without committing the files by running `bash .git/hooks/pre-commit`

## SES + Cognito

[Setup Guide](./docs/SES.md)
