"""
Thin wrapper around Jinja2 + WeasyPrint.

- `render_html(template_name, context)` is unit-testable — pure Jinja2,
   no WeasyPrint or native libs required.
- `render_pdf(template_name, context)` imports WeasyPrint lazily so
   this module can be imported by tests that don't need a PDF rendered.
"""
import os

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")

_env = Environment(
    loader=FileSystemLoader(_TEMPLATE_DIR),
    autoescape=select_autoescape(["html"]),
)


def _silhouette_data_uri():
    """Render the generic person silhouette SVG to a PNG data URI.

    Inline SVG inside the avatar's circular `overflow: hidden` clip didn't
    size reliably on the Lambda WeasyPrint runtime — the SVG ignored its
    container's width and overflowed, pushing the silhouette column wider
    than the others and breaking the podium layout. Rasterising via
    CairoSVG (the same path the avatars use) produces a normal <img> that
    sizes deterministically.
    """
    import base64
    try:
        from cairosvg import svg2png
    except ImportError:
        return None
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        '<rect width="100" height="100" fill="#E1E5EA"/>'
        '<circle cx="50" cy="38" r="18" fill="#9AA4B2"/>'
        '<path d="M14 100 C14 72, 32 60, 50 60 C68 60, 86 72, 86 100 Z" fill="#9AA4B2"/>'
        '</svg>'
    )
    png = svg2png(bytestring=svg.encode("utf-8"), output_width=200, output_height=200)
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


# Computed once at module load and exposed to every template via Jinja's
# globals dict — the SVG is constant so the URI can be reused across renders.
_env.globals["silhouette_url"] = _silhouette_data_uri()


def render_html(template_name: str, context: dict) -> str:
    """Render a Jinja2 template to HTML. No PDF, no WeasyPrint."""
    tpl = _env.get_template(template_name)
    return tpl.render(**context)


def render_pdf(template_name: str, context: dict) -> bytes:
    """Render a Jinja2 template all the way to PDF bytes."""
    from weasyprint import HTML  # lazy import — needs the native layer

    html = render_html(template_name, context)
    return HTML(string=html, base_url=_TEMPLATE_DIR).write_pdf()
