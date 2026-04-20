# Race results PDF Lambda — packaged as a container image rather than a zip
# because WeasyPrint needs cairo/pango/gdk-pixbuf native libs that are
# painful to ship via a Lambda layer (cffi's dlopen name-matching doesn't
# play nicely with LD_LIBRARY_PATH on a stock AWS Lambda zip runtime).
# The container image lets dnf install the libs normally, so ldconfig
# builds the usual ld.so.cache and dlopen/find_library work as expected.
FROM public.ecr.aws/lambda/python:3.12

# Native libraries WeasyPrint depends on. Installed via dnf exactly as you
# would on any Linux box — no symlink gymnastics.
RUN dnf install -y \
    cairo \
    pango \
    gdk-pixbuf2 \
    fontconfig \
    freetype \
    libffi \
    libjpeg-turbo \
    libpng \
    harfbuzz \
    dejavu-sans-fonts \
    dejavu-serif-fonts \
    && dnf clean all

# Pre-build the fontconfig cache at image build time so runtime doesn't have
# to (Lambda's /var/task and /opt are read-only, so fontconfig can't write
# its cache at runtime — it falls back to re-scanning every font on every
# render, which makes bulk certificate generation drop dead slow).
RUN fc-cache -f

# Python dependencies (WeasyPrint, Jinja2, powertools, boto3).
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt -t ${LAMBDA_TASK_ROOT}

# Lambda code + Jinja templates + the DeepRacer logo asset.
COPY index.py race_summary.py render.py ${LAMBDA_TASK_ROOT}/
COPY templates ${LAMBDA_TASK_ROOT}/templates

CMD ["index.lambda_handler"]
