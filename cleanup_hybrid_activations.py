import boto3
from datetime import date, datetime
import simplejson as json

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError("Type %s not serializable" % type(obj))

client = boto3.client('ssm')
next_token=""

while next_token is not None:
    if next_token == "":
        response = client.describe_activations(
            MaxResults=50,
        )
    else: 
        response = client.describe_activations(
            MaxResults=50,
            NextToken=next_token
        )

    now = datetime.now()
    unused_activations = []
    for activation in response['ActivationList']:
        if activation['RegistrationsCount'] == 0:
            #print('not used')
            if activation['ExpirationDate'].isoformat() < now.isoformat():
                #print('too old')
                unused_activations.append(activation)

    #print(json.dumps(unused_activations, default=json_serial, indent=4))
    # print(len(unused_activations))

    for activation in unused_activations:
        print(activation['ActivationId'])
        response = client.delete_activation(
            ActivationId=activation['ActivationId']
        )
        #print(json.dumps(response, default=json_serial, indent=4))
        #print('')

    print(len(unused_activations))
    if "NextToken" in response:
        next_token = response['NextToken']
        print('Next Token: {}'.format(next_token))
        print('')
    else:
        break