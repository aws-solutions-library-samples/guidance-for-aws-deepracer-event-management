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

# Pre-build the fontconfig cache at image build time — `-s` writes the
# cache into the font directories themselves (instead of ~/.cache/fontconfig
# which is tied to the build user's HOME and invisible to Lambda's runtime
# user). Without this, fontconfig re-scans every font on every render and
# bulk certificate generation crawls.
RUN fc-cache -sf

# Python dependencies (WeasyPrint, Jinja2, powertools, boto3).
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt -t ${LAMBDA_TASK_ROOT}

# Lambda code + Jinja templates + the DeepRacer logo asset.
# Three handlers share this image via CMD override (see CDK construct):
#   - index.lambda_handler     — AppSync resolver (generateRaceResultsPdf, updatePdfJob, getPdfJob)
#   - worker.lambda_handler    — async PDF renderer
# All share shared.py helpers + appsync_iam.py for IAM-signed callbacks.
COPY index.py worker.py shared.py appsync_iam.py race_summary.py render.py avatar.py flag.py ${LAMBDA_TASK_ROOT}/
COPY templates ${LAMBDA_TASK_ROOT}/templates

CMD ["index.lambda_handler"]
