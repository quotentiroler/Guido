# `guido` — configuration, compiled

Turns your AI into someone who edits configuration **correctly**. It bundles:

- **The `guido` skill** — when you paste a config file, a launcher command line, or ask
  whether a combination of settings is valid, the agent works through Guido rather than
  hand-editing text.
- **The hosted MCP server** — `https://guido-manager.maxivities.workers.dev/mcp`. It holds
  each config as fields plus rules, and renders JSON, YAML, INI, `.env`, `.properties`,
  `.txt` or a command-line flag string from the same template.

## Install — Claude Code

```
/plugin marketplace add quotentiroler/Guido
/plugin install guido@guido
```

Then restart Claude Code (or `/reload-plugins`). Try it locally first with
`claude --plugin-dir ./plugins/guido`.

## Install — Codex

```
codex plugin marketplace add quotentiroler/Guido
codex plugin add guido@guido
```

`marketplace add` registers the source; `plugin add` installs the plugin
(`guido@guido` = the `guido` plugin from the `guido` marketplace). Restart Codex after
installing.

## Manual MCP config (any MCP client)

```json
{
  "mcpServers": {
    "guido": { "url": "https://guido-manager.maxivities.workers.dev/mcp" }
  }
}
```

## Local files instead of the hosted server

The hosted server holds templates for you. If you would rather keep `.guido.json` files on
your own disk, run the open-source stdio server instead — same tools, your filesystem, no
account:

```json
{
  "mcpServers": {
    "guido": {
      "command": "npx",
      "args": ["-y", "@quotentiroler/guido-mcp-server", "--template", "./my-app.guido.json"]
    }
  }
}
```

The stdio server's `import_settings` takes a file **path**; the hosted one takes the
content **inline**, because a Worker has no filesystem.

## What it is good at

| Ask | What happens |
| --- | --- |
| "Change the port and turn off low VRAM" | Rules re-run; a false boolean becomes an absent flag, not `--flag false` |
| "Why is this setting ignored?" | `explain_field` traces the rule that disabled it |
| "Give me this as a `.env`" | Same template, different renderer, keys upper-snaked |
| "Is this combination valid?" | `validate_template` reports contradictions and circular rules |
