FROM public.ecr.aws/lambda/python:3.12

ARG CACHE_DATE=1
RUN dnf update -y \
    && dnf -y install clamav1.4 clamd1.4 p7zip which \
    && dnf clean all \
    && pip3 install --no-cache-dir cffi awslambdaric boto3 requests aws-lambda-powertools \
    && ln -s /etc/freshclam.conf /tmp/freshclam.conf \
    && mkdir -p /var/task/bin /var/task/var/lib/clamav /tmp/clamav \
    && chmod -R 777 /var/task/var/lib/clamav /tmp/clamav \
    && cp /usr/bin/clamscan /var/task/bin/clamscan

COPY index.py /var/task/index.py

ENTRYPOINT [ "/var/lang/bin/python3", "-m", "awslambdaric" ]
CMD [ "index.handler" ]
