# Help panel content

Quick guide on the steps needed to add in help panel content to DREM

## Working example:

-   Page → `website/src/admin/race-admin/raceAdmin.jsx `
-   Help panel content → `website/public/locales/en/help-admin-races.json`

## Steps

1. Create `help-<page>.json` translation file in `website/public/locales/<lang-code>/`
1. Update the namespaces available to i18n
1. Enable the help panel

### Help panel content

Example of help panel content

```
{
  "header": "## Race manager",
  "content": "So let's put some content\n * in\n * here\n * with\n * markdown",
  "footer": "### Footer info \n\nWhich is nice\n\n[AWS DeepRacer](https://aws.amazon.com/deepracer/)"
}
```

Markdown is supported, multi-line can be created using `\n` in the markdown

### Update namespace

Add your new content to the translation namespace

Update the line:

```
const { t } = useTranslation(['translation'])
```

To (assuming help panel content is saved as `help-example.json`):

```
const { t } = useTranslation(['translation', 'help-example'])
```

### Enable help panel

Change:

```
  // Help panel
  const helpPanelHidden = true;
```

To:

```
  // Help panel
  const helpPanelHidden = false;
```
