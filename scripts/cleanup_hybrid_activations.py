from datetime import date, datetime

import boto3


def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError("Type %s not serializable" % type(obj))


client = boto3.client("ssm")

paginator = client.get_paginator("describe_activations")
response_iterator = paginator.paginate(
    PaginationConfig={
        "MaxResults": 50,
    },
)


now = datetime.now()
unused_activations = []
for response in response_iterator:
    for activation in response["ActivationList"]:
        if activation["RegistrationsCount"] == 0:
            # print("not used")
            if activation["ExpirationDate"].isoformat() < now.isoformat():
                # print("too old")
                unused_activations.append(activation)

for activation in unused_activations:
    print(activation["ActivationId"])
    response = client.delete_activation(ActivationId=activation["ActivationId"])
    # print(json.dumps(activation, default=json_serial, indent=4))
    # print('')

print(len(unused_activations))
