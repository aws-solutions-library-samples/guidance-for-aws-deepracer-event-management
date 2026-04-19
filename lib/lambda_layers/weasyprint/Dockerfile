# Builds a Lambda layer with WeasyPrint + its native dependencies.
# Amazon Linux 2023 (SAM build image) ships cairo/pango/gdk-pixbuf in dnf.
FROM public.ecr.aws/sam/build-python3.12:latest-arm64

RUN dnf install -y \
    cairo \
    cairo-gobject \
    pango \
    gdk-pixbuf2 \
    glib2 \
    fontconfig \
    freetype \
    libffi \
    libjpeg-turbo \
    libpng \
    && dnf clean all

# Bundle the native libs into the layer's /opt/lib so they're loadable at
# runtime (Lambda adds /opt/lib to LD_LIBRARY_PATH automatically).
WORKDIR /asset-output
RUN mkdir -p python/lib lib && \
    cp -P /usr/lib64/libcairo* lib/ && \
    cp -P /usr/lib64/libpango* lib/ && \
    cp -P /usr/lib64/libgdk_pixbuf* lib/ && \
    cp -P /usr/lib64/libgobject* lib/ && \
    cp -P /usr/lib64/libglib* lib/ && \
    cp -P /usr/lib64/libgio* lib/ && \
    cp -P /usr/lib64/libfontconfig* lib/ && \
    cp -P /usr/lib64/libfreetype* lib/ && \
    cp -P /usr/lib64/libffi* lib/ && \
    cp -P /usr/lib64/libjpeg* lib/ && \
    cp -P /usr/lib64/libpng* lib/ && \
    cp -P /usr/lib64/libharfbuzz* lib/ 2>/dev/null || true && \
    cp -P /usr/lib64/libfribidi* lib/ 2>/dev/null || true && \
    cp -P /usr/lib64/libthai* lib/ 2>/dev/null || true && \
    cp -P /usr/lib64/libdatrie* lib/ 2>/dev/null || true

COPY requirements.txt .
RUN pip install --no-cache-dir --target python -r requirements.txt
