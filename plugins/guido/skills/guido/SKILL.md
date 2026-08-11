---
name: guido
description: Read, change and validate a configuration file through the Guido MCP server instead of hand-editing it. Use when the user is editing app settings, a launcher command line, an INI/YAML/.env/.properties file, a ComfyUI prompt graph or any other config; when they ask which flags or values are valid together; when a setting "isn't taking effect"; or when they want the same settings rendered in another format. Triggers on "config", "settings", "appsettings", "config.ini", ".env", "launch flags", "command line arguments", "workflow json", "why is this disabled", "is this combination valid".
interface:
  display_name: "Guido"
  short_description: "Configuration, compiled — one template, every format."
  brand_color: "#FDD106"
---

# Guido — configuration, compiled

You have access to the **Guido** MCP server. It holds configuration as a *template*: a list
of fields with values, plus rules that decide which values may be set together. From one
template it renders JSON, YAML, INI, `.env`, `.properties`, plain `key=value` or a
command-line flag string, and it can read any of those back.

Use it instead of editing a config file by hand. Hand-editing loses the two things Guido
adds: the rules, and a rendering that is correct for the target format.

## When to reach for it

- The user pastes a config file, a launcher line, or asks you to change a setting.
- They ask whether a combination is valid, or why something has no effect.
- They want the same settings in a different format (a `.env` from an `appsettings.json`,
  an INI from a flag string).
- They are tuning a node-graph config such as a ComfyUI API prompt.

## The loop

1. **`list_templates`** — see what already exists. Do not create a second template for a
   config that is already managed.
2. **`import_settings`** — paste the config text **inline** (this server takes content, not
   a path). It derives the fields. `format` is inferred from the template's filename;
   override it when the text is something else.
3. **`set_fields`** — change values. The rule engine re-runs and the response reports what
   the rules disabled, which is the answer to "why did that not take effect".
4. **`export_config`** — render the result. Give this back to the user as the file to use.

`validate_template` reports contradictions and circular rules; `explain_field` traces why a
field ended up in its current state, following the rules that forced it.

## Things that will bite you

- **`export_config` defaults to `onlyChecked: true`**, which emits just the fields marked
  tunable. For anything that must stay structurally complete — a ComfyUI prompt graph, a
  full `appsettings.json` — pass `onlyChecked: false` or you will hand back a fragment.
- **Importing a node graph**: pass `select: "graph-inputs"` so only `<node>.inputs.<name>`
  is marked tunable and links stay untouched structure. Without it every link and
  `class_type` is presented as something to edit.
- **Plans limit templates and monthly calls.** A refusal comes back as a plain message
  naming the limit — relay it rather than retrying.
- **Field names are dot paths.** `Server.Port`, `3.inputs.seed`, `default.security_level`.
  For INI the first dot is the section boundary; for `.env` keys are upper-snaked on export.

## Worked example — a launcher line

The user pastes `--windows-standalone-build --lowvram --port 8188` and asks to raise the
port and switch off low VRAM.

```
import_settings  { ref, content: "--windows-standalone-build --lowvram --port 8188" }
set_fields       { ref, values: { "port": 8189, "lowvram": false } }
export_config    { ref }
```

The export comes back as a launcher line again, with `--lowvram` gone because a false
boolean is an absent flag — not as `--lowvram false`, which is what hand-editing produces
and what the tool would then reject.
