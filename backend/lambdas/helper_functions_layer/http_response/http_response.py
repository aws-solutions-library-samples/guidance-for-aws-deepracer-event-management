from datetime import date, datetime
import simplejson as json


class Response:
    def __init__(self, code, message):
        self.code = code
        self.message = message
        return {
            'headers': {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",  # Required for CORS support to work
                "Access-Control-Allow-Credentials": True  # Required for cookies, authorization headers with HTTPS
            },
            'statusCode': self.code,
            'body': json.dumps(self.message, default=json_serial)
        }


def json_serial( obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError("Type %s not serializable" % type(obj))
