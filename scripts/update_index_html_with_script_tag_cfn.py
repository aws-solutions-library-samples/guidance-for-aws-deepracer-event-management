import json
import re

with open("cfn.outputs") as json_file:
    data = json.load(json_file)

    for key in data:
        if key["OutputKey"] == "rumScript":
            rum_script = key["OutputValue"]

with open("website/public/index.html", "r") as index_file:
    content = index_file.read()
    content_new = re.sub(
        "<script>.+(AwsRumClient).+<\/script>", rum_script, content, flags=re.M
    )

with open("website/public/index.html", "w") as index_file_out:
    index_file_out.write(content_new)
