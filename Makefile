all: frontend.deploy

frontend.deploy: infra.deploy
	cdk deploy CdkDeepRacerEventManagerFEDeployStack --require-approval never

infra.deploy:
	echo "{}" > website/src/config.json
	cdk deploy CdkDeepRacerEventManagerStack --require-approval never --outputs-file cdk.outputs
	python generate_amplify_config.py

clean: 
	cdk destroy

.NOTPARALLEL: