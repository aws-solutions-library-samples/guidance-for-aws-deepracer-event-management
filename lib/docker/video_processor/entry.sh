#!/bin/bash
set -euo pipefail

# Source ROS environment
source /var/task/install/setup.bash

# Start the Lambda Runtime Interface Client
exec python3 -m awslambdaric $1
