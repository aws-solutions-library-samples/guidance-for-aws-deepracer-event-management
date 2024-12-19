FROM ros:humble-ros-base

# Container Dependency Setup
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    libboost-all-dev \
    python3-pip \
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

# Install tensorflow and visualization
RUN pip3 install -U --no-cache-dir 'tensorflow-cpu<2.17' \
                               python-resize-image \
                               'deepracer-utils>=1.0.3' \
                               pillow \
                               pandas \
                               'numpy<2' \
                               python-dateutil \
                               tqdm

RUN mkdir -p /workspace/analysis /workspace/src /workspace/logs /workspace/models /workspace/.tmp/matplotlib && chmod o+rw /workspace/.tmp/matplotlib
ENV MPLCONFIGDIR=/workspace/.tmp/matplotlib

RUN cd /workspace/src && \
    git clone -b logging https://github.com/larsll/deepracer-viz && \
    git clone -b compressed-image https://github.com/larsll/aws-deepracer-interfaces-pkg && \
    bash -c 'cd /workspace && source /opt/ros/humble/setup.bash && colcon build --merge-install && rm -rf build && rm -rf log ' 

# Copy function code
COPY app.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "app.lambda_handler" ]
