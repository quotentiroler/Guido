import { isFieldRequired, resolveRuleSetRules, findRuleSet } from '@quotentiroler/guido-core';
import type { Field, FieldValue, Template } from '@quotentiroler/guido-types';

const MARKER = /<!-- guido:fields (#[a-z0-9-]+) -->[\s\S]*?<!-- \/guido:fields -->/g;
const MARKER_LINE = /^<!-- guido:fields (#[a-z0-9-]+) -->$/;
const SECRET_CELL = '*secret*';
const MARKDOWN_CELL_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '|': '\\|' };

export const toLf = (text: string): string => text.replace(/\r\n/g, '\n');
export const eolOf = (text: string): string => (text.includes('\r\n') ? '\r\n' : '\n');
export const withEol = (text: string, eol: string): string => text.replace(/\n/g, eol);

export const anchorOf = (field: Field): string => `#${(field.link ?? '').split('#')[1] ?? ''}`;

const isEmpty = (value: FieldValue): boolean => value === '' || (Array.isArray(value) && value.length === 0);
const valueText = (value: FieldValue): string => (Array.isArray(value) ? value.join(',') : String(value));
const tableCell = (text: string): string => text.replace(/[&<>|]/g, (c) => MARKDOWN_CELL_ESCAPES[c] ?? c);

const defaultCell = (field: Field): string => {
  if (field.secret) return SECRET_CELL;
  return isEmpty(field.value) ? '--' : `\`${valueText(field.value)}\``;
};

const fieldsTable = (fields: readonly Field[]): string =>
  [
    '| Variable | Description | Default |',
    '|---|---|---|',
    ...fields.map((f) => `| \`${f.name}\` | ${tableCell(f.info)} | ${defaultCell(f)} |`),
  ].join('\n');

const groupedBy = (fields: readonly Field[], anchor: string): Field[] => fields.filter((f) => anchorOf(f) === anchor);

/** Docs with every marked table regenerated from the fields linking to its anchor; prose around the tables stays as written. */
export function renderDocs(docs: string, fields: readonly Field[]): string {
  const used = new Set<string>();
  const out = toLf(docs).replace(MARKER, (_, anchor: string) => {
    const group = groupedBy(fields, anchor);
    if (group.length === 0) throw new Error(`docs marker ${anchor} has no template fields`);
    used.add(anchor);
    return `<!-- guido:fields ${anchor} -->\n${fieldsTable(group)}\n<!-- /guido:fields -->`;
  });
  const orphans = [...new Set(fields.map(anchorOf))].filter((anchor) => !used.has(anchor));
  if (orphans.length > 0) throw new Error(`template fields link to sections with no docs marker: ${orphans.join(', ')}`);
  return out;
}

const titleOf = (anchor: string): string => {
  const words = anchor.slice(1).split('-').filter(Boolean).join(' ');
  return words ? words[0].toUpperCase() + words.slice(1) : 'General';
};

/** A starting docs page: one section with an empty marker per anchor, in template order. */
export function scaffoldDocs(template: Template): string {
  const anchors = [...new Set(template.fields.map(anchorOf))];
  const sections = anchors.flatMap((anchor) => [`## ${titleOf(anchor)}`, '', `<!-- guido:fields ${anchor} -->`, '<!-- /guido:fields -->', '']);
  return [`# ${template.name} configuration`, '', ...sections].join('\n');
}

export type Section = readonly [anchor: string, heading: string];

/** Docs sections in page order: the marker anchor and the heading above it. */
export function docsSections(docs: string): Section[] {
  const result: Section[] = [];
  let heading = '';
  for (const line of toLf(docs).split('\n')) {
    const h = /^##+\s+(.*)$/.exec(line);
    if (h) heading = h[1];
    const m = MARKER_LINE.exec(line);
    if (m) result.push([m[1], heading]);
  }
  return result;
}

export const templateSections = (template: Template): Section[] =>
  [...new Set(template.fields.map(anchorOf))].map((anchor) => [anchor, titleOf(anchor)]);

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current && current.length + word.length + 1 > width) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
}

const requiredFields = (template: Template, rulesetName: string | undefined): Set<string> => {
  if (!rulesetName) return new Set();
  if (!findRuleSet(template, rulesetName)) throw new Error(`requiredRuleset "${rulesetName}" is not a ruleset of the template`);
  const rules = resolveRuleSetRules(template, rulesetName);
  return new Set(template.fields.map((f) => f.name).filter((name) => isFieldRequired(name, rules)));
};

export interface EnvExampleOptions {
  header: readonly string[];
  sections: readonly Section[];
  requiredRuleset?: string;
  wrap?: number;
}

const envLine = (field: Field, required: boolean): string => {
  if (field.secret) return required ? `${field.name}=` : `# ${field.name}=`;
  return required ? `${field.name}=${field.example}` : `# ${field.name}=${valueText(field.value)}`;
};

/** An env file: required fields uncommented with their example, the rest commented with their default; secrets carry no value. */
export function renderEnvExample(template: Template, options: EnvExampleOptions): string {
  const required = requiredFields(template, options.requiredRuleset);
  const out = [...options.header];
  for (const [anchor, heading] of options.sections) {
    out.push('', `# ── ${heading} ${'─'.repeat(Math.max(3, 60 - heading.length))}`);
    for (const field of groupedBy(template.fields, anchor)) {
      out.push(...wrap(field.info, options.wrap ?? 88).map((line) => `# ${line}`));
      out.push(envLine(field, required.has(field.name)));
    }
  }
  return out.join('\n') + '\n';
}
