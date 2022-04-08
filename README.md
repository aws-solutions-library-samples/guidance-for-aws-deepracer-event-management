
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
$ pip install -r requirements.txt
```

At this point, set your default account and region and then you can deploy DREM by simply running make.

```
$ make
```

## Useful commands

 * `cdk ls`          list all stacks in the app
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk docs`        open CDK documentation

Enjoy!
