FROM ros:humble-ros-base

# Install Python and AWS Lambda Runtime Interface Client
RUN apt-get update && apt-get install -y \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Create Lambda runtime directory structure
RUN mkdir -p /var/runtime /var/task /var/task/src /var/task/.tmp/matplotlib

# Install additional dependencies
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    libboost-all-dev \
    ros-humble-image-transport \
    ros-humble-compressed-image-transport \
    ros-humble-cv-bridge \
    ros-humble-pybind11-vendor \
    ros-humble-test-msgs \
    libjsoncpp-dev \
    v4l-utils \
    ffmpeg \
    libx264-dev \
    curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip3 install -U --no-cache-dir 'tensorflow-cpu<2.17' \
    python-resize-image \
    'deepracer-utils>=1.0.3' \
    pillow \
    pandas \
    'numpy<2' \
    python-dateutil \
    tqdm \
    aws-lambda-powertools \
    requests-aws4auth

# Set up workspace
ENV MPLCONFIGDIR=/var/task/.tmp/matplotlib

RUN cd /var/task/src && \
    git clone -b logging https://github.com/larsll/deepracer-viz && \
    git clone -b compressed-image https://github.com/larsll/aws-deepracer-interfaces-pkg && \
    bash -c 'cd /var/task && source /opt/ros/humble/setup.bash && colcon build --merge-install && rm -rf build && rm -rf log && rm -rf src'

# Copy function code
COPY *.py /var/task/
ADD resources /var/task/resources

# Set up entry point for Lambda
COPY entry.sh /
RUN chmod +x /entry.sh

ENTRYPOINT ["/entry.sh"]
CMD ["/var/task/process_batch.py"]
