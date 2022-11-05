import boto3
from datetime import date, datetime
import simplejson as json

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError("Type %s not serializable" % type(obj))

client = boto3.client('ssm')
response = client.describe_activations()
print(json.dumps(response, default=json_serial, indent=4))