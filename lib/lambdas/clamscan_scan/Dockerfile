FROM  amazonlinux:2 AS layer-image
WORKDIR /home/build

RUN rm -rf bin && rm -rf lib \
    && yum update -y \
    && yum install -y amazon-linux-extras \
    && PYTHON=python2 amazon-linux-extras install epel \
    && yum clean all \
    && yum -y install clamav p7zip which \
    && mkdir -p bin \
    && mkdir -p lib \
    && mkdir -p var/lib/clamav \
    && mkdir -p /tmp/clamav \
    && chmod -R 777 var/lib/clamav \
    && chmod -R 777 /tmp/clamav \
    && cp /usr/bin/clamscan bin/.

FROM public.ecr.aws/lambda/python:3.9

ARG CACHE_DATE=1
RUN yum update -y \
    && yum install -y amazon-linux-extras \
    && PYTHON=python2 amazon-linux-extras install epel \
    && yum -y install clamav clamd \
    && yum clean all \
    && pip3 install --no-cache-dir cffi awslambdaric boto3 requests aws-lambda-powertools \
    && ln -s /etc/freshclam.conf /tmp/freshclam.conf

COPY --from=layer-image /home/build ./
COPY index.py /var/task/index.py

ENTRYPOINT [ "/var/lang/bin/python3", "-m", "awslambdaric" ]
CMD [ "index.handler" ]