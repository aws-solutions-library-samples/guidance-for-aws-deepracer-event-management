FROM public.ecr.aws/docker/library/ros:jazzy-ros-base

# Set the Ubuntu mirrors
ARG AWS_REGION=us-east-1
RUN sed -i "s|http://archive.ubuntu.com|http://${AWS_REGION}.ec2.archive.ubuntu.com|g" /etc/apt/sources.list && \
    sed -i "s|http://security.ubuntu.com|http://${AWS_REGION}.ec2.archive.ubuntu.com|g" /etc/apt/sources.list

# Create Lambda runtime directory structure
RUN mkdir -p /var/runtime /var/task /var/task/src /var/task/.tmp/matplotlib

# Install additional dependencies
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    libboost-all-dev \
    ros-jazzy-image-transport \
    ros-jazzy-compressed-image-transport \
    ros-jazzy-cv-bridge \
    ros-jazzy-pybind11-vendor \
    ros-jazzy-test-msgs \
    ros-jazzy-rosbag2-storage-mcap \
    python3-pip \
    libjsoncpp-dev \
    v4l-utils \
    ffmpeg \
    libx264-dev \
    curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip3 install -U --break-system-packages --no-cache-dir 'tensorflow-cpu<2.17' \
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
    bash -c 'cd /var/task && source /opt/ros/jazzy/setup.bash && colcon build --merge-install && rm -rf build && rm -rf log && rm -rf src'

# Copy function code
COPY *.py /var/task/
ADD resources /var/task/resources

# Set up entry point for Lambda
COPY entry.sh /
RUN chmod +x /entry.sh

ENTRYPOINT ["/entry.sh"]
CMD ["/var/task/process_batch.py"]
