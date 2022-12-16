import json
import re

with open("cfn.outputs") as json_file:
    data = json.load(json_file)

    for key in data:
        if key["OutputKey"] == "rumScript":
            rum_script = key["OutputValue"]

# print(rum_script)

out_lines = []
# Read in the file

with open("website/public/index.html", "r") as index_file:
    for line in index_file:
        # correct script after <head>
        if re.search(r"<head>", line):
            out_lines.append(line)
            out_lines.append("    " + rum_script + "\n")
        # remove any exisiting script line
        elif not re.search(r"<script>.+AwsRumClient.+<\/script>", line):
            out_lines.append(line)


print(out_lines)
# Write the file out again
with open("website/public/index.html", "w") as index_file_out:
    for line in out_lines:
        index_file_out.write(line)
