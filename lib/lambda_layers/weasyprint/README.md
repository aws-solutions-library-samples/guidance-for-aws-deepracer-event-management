# WeasyPrint Lambda Layer

Custom Lambda layer for the PDF feature. Unlike pure-Python layers
(`helper_functions`, `appsync_helpers`), WeasyPrint needs native
dependencies (cairo, pango, gdk-pixbuf, glib, fontconfig) that aren't
pip-installable — hence the custom Dockerfile.

## How the build works

1. Starts from `public.ecr.aws/sam/build-python3.12:latest-arm64` so the
   resulting .so files match Lambda ARM64 runtime.
2. `dnf install`s the system libraries WeasyPrint links against.
3. Copies the shared-object files into `/asset-output/lib/` — Lambda
   adds `/opt/lib` to `LD_LIBRARY_PATH`, so WeasyPrint finds them at
   runtime.
4. `pip install`s WeasyPrint + Jinja2 into `/asset-output/python/` where
   the Lambda runtime can import them.

## Size

~60-80MB — well within Lambda's 250MB unzipped layer limit.
