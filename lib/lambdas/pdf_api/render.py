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


def render_html(template_name: str, context: dict) -> str:
    """Render a Jinja2 template to HTML. No PDF, no WeasyPrint."""
    tpl = _env.get_template(template_name)
    return tpl.render(**context)


def render_pdf(template_name: str, context: dict) -> bytes:
    """Render a Jinja2 template all the way to PDF bytes."""
    from weasyprint import HTML  # lazy import — needs the native layer

    html = render_html(template_name, context)
    return HTML(string=html, base_url=_TEMPLATE_DIR).write_pdf()
