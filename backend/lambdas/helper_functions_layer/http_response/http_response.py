from datetime import date, datetime
import simplejson as json


def response(code, message=None):

    if message is None:
        message = {"message": ""}
    elif isinstance(message, str):
        message = {"message": message}
    elif isinstance(message, Exception):
        message = {"message": message.args[0]}

    return {
        'headers': {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",  # Required for CORS support to work
            "Access-Control-Allow-Credentials": True  # Required for cookies, authorization headers with HTTPS
        },
        'statusCode': code,
        'body': json.dumps(message, default=json_serial)
    }


def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError("Type %s not serializable" % type(obj))
