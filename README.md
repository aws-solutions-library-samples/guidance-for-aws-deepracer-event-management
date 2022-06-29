
# Welcome to DeepRacer Event Manager (DREM)

## PreReqs
Docker Desktop  
Python (Tested with 3.9.10)  
CDK (Tested with 2.16.0)  

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
$ pytest --cov
```

At this point, set your default account and region and then you can deploy DREM by simply running make.

```
$ make
```

## Useful commands

 * `make all` 
    * deploy all stacks to your default AWS account/region
 * `make frontend.only.deploy` 
    * deploy only the frontend
    * requires that you have already completed a full `make` to ensure the backend is already deployed and the local config files have been generated

## SES + Cognito
[Setup Guide](./SES.md)


