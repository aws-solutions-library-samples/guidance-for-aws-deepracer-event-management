FROM  amazonlinux:2023 AS layer-image
WORKDIR /home/build

RUN rm -rf bin && rm -rf lib \
    && dnf update -y \
    && dnf install -y clamav1.4 p7zip which \
    && dnf clean all \
    && mkdir -p bin \
    && mkdir -p lib \
    && mkdir -p var/lib/clamav \
    && mkdir -p /tmp/clamav \
    && chmod -R 777 var/lib/clamav \
    && chmod -R 777 /tmp/clamav \
    && cp /usr/bin/clamscan bin/.

FROM public.ecr.aws/lambda/python:3.12

ARG CACHE_DATE=1
RUN dnf update -y \
    && dnf -y install clamav1.4 clamd1.4 \
    && dnf clean all \
    && pip3 install --no-cache-dir cffi awslambdaric boto3 requests aws-lambda-powertools \
    && ln -s /etc/freshclam.conf /tmp/freshclam.conf

COPY --from=layer-image /home/build ./
COPY index.py /var/task/index.py

ENTRYPOINT [ "/var/lang/bin/python3", "-m", "awslambdaric" ]
CMD [ "index.handler" ]