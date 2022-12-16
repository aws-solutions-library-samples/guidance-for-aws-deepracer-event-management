# Welcome to DeepRacer Event Manager (DREM)

## PreReqs

-   [Docker Desktop](https://www.docker.com/)
-   [Python](https://www.python.org/) (Tested with 3.9.10)
-   [AWS CDK](https://aws.amazon.com/cdk/) (Tested with 2.47.0)

Create a Parameter Store Key called '/drem/S3RepoBucket' with a value of the S3 Bucket ARN for the codepipeline source e.g. 'arn:aws:s3:::drem-pipeline-zip-123456789012-eu-west-1'

## Install

Create a virtualenv on MacOS and Linux if you haven't already:

```
$ python3 -m venv .venv
```

After the init process completes and the virtualenv is created, you can use the following
step to activate your virtualenv.

```
$ source .venv/bin/activate
```

If you are a Windows platform, you would activate the virtualenv like this:

```
% .venv\Scripts\activate.bat
```

Once the virtualenv is activated, you can install the required dependencies.

```
$ pip install -r requirements-dev.txt  # For development and unit testing
$ pip install -r requirements.txt      # For CDK deployment
```

Run unit tests

```
$ pytest
```

At this point, set your default account and region and then you can deploy DREM by simply running make.

```
$ make
```

## Pipeline Deploy (Branch)

1. Protect the branch through GitLab -> Settings -> [Repository](https://gitlab.aws.dev/dasmthc/deepracer-event-manager/-/settings/repository)
2. Add the branch name to `.gitlab-ci.yml`
3. `echo "branch-name" > branch.txt`
4. `echo "email@domain.com" > email.txt` for the admin email address
5. Run `make pipeline.deploy` from local to "bootstrap" the cdk pipeline for the users branch

## Local

1. Run `make local.config` to build the local config from the CloudFormation stack and create the GraphQL schema
2. Run `make local.install` to install the internet
3. Run `make local.run` to run the frontend locally

## Setup development environment

### Setup pre commit hooks

-   create and activate a virtualenv
-   install dependenies `$ pip install -r requirements-dev.txt `
-   install pre-commit hooks`$ pre-commit install`

The pre-commit hooks will only run towards changed files. You can manually run a pre-commit hook test without commiting the files by running `bash .git/hooks/pre-commit`

### Setup vs code environment

-   Install the vscode eslint and prettier extensions
-   Add this to the vscode settings.json file for the workspace

```
{
    "[javascript]": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.codeActionsOnSave": {
            "source.fixAll.eslint": true
        }
    },
    "eslint.validate": [
        "javascript"
    ],
    "editor.formatOnSave": true,
    "python.formatting.provider": "black",
    "python.formatting.blackArgs": [
        "--experimental-string-processing"
    ],
    "python.linting.flake8Enabled": true,
    "python.linting.enabled": true,
    "python.testing.pytestEnabled": true,
    "python.testing.pytestArgs": [
        "tests"
    ],
    "editor.codeActionsOnSave": {
        "source.organizeImports": true,
        "source.fixAll.eslint": true
    },
}
```

With these changes the python code will be autoformated on save according to blake and the imports will be sorted with isort

## Useful commands

-   `make all`
    -   deploy all stacks to your default AWS account/region
-   `make frontend.only.deploy`
    -   deploy only the frontend
    -   requires that you have already completed a full `make` to ensure the backend is already deployed and the local config files have been generated

## SES + Cognito

[Setup Guide](./SES.md)
