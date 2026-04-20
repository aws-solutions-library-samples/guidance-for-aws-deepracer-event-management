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

# WeasyPrint's ffi.py calls ffi.dlopen() with a list of name candidates:
#   pango = _dlopen(ffi, 'pango-1.0-0', 'pango-1.0', 'pango', 'libpango-1.0-0')
# For each bare name cffi uses this logic:
#   - if the name contains a dot (e.g. 'pango-1.0-0'), try dlopen(name) as-is
#   - else (e.g. 'pango'), try dlopen('lib{name}.so') first, then dlopen(name)
# Our dnf-installed libs only ship the versioned SONAME `libpango-1.0.so.0`,
# so none of those four candidates match without symlinks. Create all the
# short-name symlinks WeasyPrint actually tries:
#   libpango.so            ← matches 'pango' via cffi's lib*.so wrap
#   libpango-1.0.so        ← versioned short name
#   libpango-1.0-0.so      ← 'libpango-1.0-0' candidate
WORKDIR /asset-output/lib
RUN for base in pango-1.0 pangocairo-1.0 pangoft2-1.0 \
                gobject-2.0 gdk_pixbuf-2.0 \
                glib-2.0 gio-2.0; do \
      if [ -e "lib${base}.so.0" ]; then \
        ln -sf "lib${base}.so.0" "lib${base}.so"; \
        ln -sf "lib${base}.so.0" "lib${base}-0.so"; \
        short=$(echo "${base}" | sed 's/-[0-9].*//'); \
        ln -sf "lib${base}.so.0" "lib${short}.so"; \
      fi; \
    done && \
    for short_simple in cairo fontconfig harfbuzz; do \
      target=$(ls lib${short_simple}.so.* 2>/dev/null | sort -V | head -1); \
      if [ -n "$target" ]; then \
        ln -sf "$target" "lib${short_simple}.so"; \
      fi; \
    done

WORKDIR /asset-output
COPY requirements.txt .
RUN pip install --no-cache-dir --target python -r requirements.txt
