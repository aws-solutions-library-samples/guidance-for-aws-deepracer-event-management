all: frontend.deploy

frontend.deploy: frontend.config
	cdk deploy CdkDeepRacerEventManagerFEDeployStack --require-approval never

frontend.config: infra.deploy
	python generate_amplify_config.py
	python update_index_html_with_script_tag.py

infra.deploy:
	echo "{}" > website/src/config.json
	cdk deploy CdkDeepRacerEventManagerStack --require-approval never --outputs-file cdk.outputs

clean:
	cdk destroy

local.install:
	python generate_amplify_config.py
	npm install --prefix website

local.run:
	npm start --prefix website

.NOTPARALLEL:
