import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseApplyRulesArgs } from './applyRules.js';
import { parseValidateSettingsArgs } from './validateSettings.js';
import { parseValidateTemplateArgs } from './validateTemplate.js';
import { parseSchemaToGuidoArgs } from './schemaToGuido.js';
import { parseGuidoToSchemaArgs } from './guidoToSchema.js';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('guido-apply-rules arguments', () => {
  it('returns null for no arguments or a help flag anywhere', () => {
    expect(parseApplyRulesArgs([])).toBeNull();
    expect(parseApplyRulesArgs(['-h'])).toBeNull();
    expect(parseApplyRulesArgs(['t.json', '--help'])).toBeNull();
    expect(parseApplyRulesArgs(['-o', '-h', 't.json'])).toBeNull();
  });

  it('reads the template and optional settings positionals', () => {
    expect(parseApplyRulesArgs(['t.json'])).toEqual({ templatePath: 't.json', format: 'json', dryRun: false });
    expect(parseApplyRulesArgs(['t.json', 's.yaml', 'extra'])).toEqual({
      templatePath: 't.json',
      settingsPath: 's.yaml',
      format: 'json',
      dryRun: false,
    });
    expect(parseApplyRulesArgs(['', 't.json', 's.json'])).toMatchObject({ templatePath: 't.json', settingsPath: 's.json' });
  });

  it('reads short and long options', () => {
    const expected = { templatePath: 't.json', settingsPath: 's.json', outputPath: 'out.json', format: 'diff', dryRun: true };
    expect(parseApplyRulesArgs(['t.json', 's.json', '-o', 'out.json', '-f', 'diff', '-d'])).toEqual(expected);
    expect(parseApplyRulesArgs(['--output', 'out.json', '--format', 'diff', '--dry-run', 't.json', 's.json'])).toEqual(expected);
    expect(parseApplyRulesArgs(['t.json', '-f', 'fields'])).toMatchObject({ format: 'fields' });
    expect(parseApplyRulesArgs(['t.json', '-f', 'json', '-f', 'fields'])).toMatchObject({ format: 'fields' });
  });

  it('takes the token after a value option verbatim', () => {
    expect(parseApplyRulesArgs(['-o', '-d', 't.json'])).toEqual({ templatePath: 't.json', outputPath: '-d', format: 'json', dryRun: false });
    expect(parseApplyRulesArgs(['t.json', '-o'])).toEqual({ templatePath: 't.json', format: 'json', dryRun: false });
  });

  it('ignores unknown flags', () => {
    expect(parseApplyRulesArgs(['--verbose', 't.json'])).toEqual({ templatePath: 't.json', format: 'json', dryRun: false });
  });

  it('returns null for an invalid format or a missing template', () => {
    expect(parseApplyRulesArgs(['t.json', '-f', 'xml'])).toBeNull();
    expect(parseApplyRulesArgs(['t.json', '-f'])).toBeNull();
    expect(parseApplyRulesArgs(['t.json', '-f', 'bad', '-f', 'json'])).toBeNull();
    expect(parseApplyRulesArgs(['-d'])).toBeNull();
  });
});

describe('guido-validate-settings arguments', () => {
  it('returns null for no arguments or a help flag anywhere', () => {
    expect(parseValidateSettingsArgs([])).toBeNull();
    expect(parseValidateSettingsArgs(['-h'])).toBeNull();
    expect(parseValidateSettingsArgs(['t.json', 's.json', '--help'])).toBeNull();
    expect(parseValidateSettingsArgs(['--ruleset', '-h', 't.json', 's.json'])).toBeNull();
  });

  it('reads the template and settings positionals', () => {
    expect(parseValidateSettingsArgs(['t.json', 's.json', 'extra'])).toEqual({
      templatePath: 't.json',
      settingsPath: 's.json',
      strict: false,
      json: false,
    });
    expect(parseValidateSettingsArgs(['', 't.json', 's.json'])).toMatchObject({ templatePath: 't.json', settingsPath: 's.json' });
  });

  it('reads the options proxy-smart CI passes', () => {
    expect(parseValidateSettingsArgs(['template.json', 'settings.json', '--ruleset', 'Production', '--strict'])).toEqual({
      templatePath: 'template.json',
      settingsPath: 'settings.json',
      rulesetName: 'Production',
      strict: true,
      json: false,
    });
  });

  it('reads every option', () => {
    expect(parseValidateSettingsArgs(['--tag', 'prod', '--json', 't.json', '--ruleset', 'A', '--ruleset', 'B', 's.json'])).toEqual({
      templatePath: 't.json',
      settingsPath: 's.json',
      rulesetName: 'B',
      rulesetTag: 'prod',
      strict: false,
      json: true,
    });
  });

  it('ignores a value option that has no value', () => {
    expect(parseValidateSettingsArgs(['t.json', 's.json', '--ruleset'])).toEqual({
      templatePath: 't.json',
      settingsPath: 's.json',
      strict: false,
      json: false,
    });
    expect(parseValidateSettingsArgs(['t.json', '--tag', '', 's.json'])).toEqual({
      templatePath: 't.json',
      settingsPath: 's.json',
      strict: false,
      json: false,
    });
  });

  it('takes a non-empty token after a value option even when it looks like a flag', () => {
    expect(parseValidateSettingsArgs(['t.json', 's.json', '--ruleset', '--strict'])).toMatchObject({ rulesetName: '--strict', strict: false });
  });

  it('returns null when a positional is missing', () => {
    expect(parseValidateSettingsArgs(['t.json'])).toBeNull();
    expect(parseValidateSettingsArgs(['--strict'])).toBeNull();
    expect(parseValidateSettingsArgs(['t.json', '--ruleset', 's.json'])).toBeNull();
  });
});

describe('guido-validate-template arguments', () => {
  it('flags help only for a help token that is not an option value', () => {
    expect(parseValidateTemplateArgs(['-h'])).toEqual({ all: false, help: true });
    expect(parseValidateTemplateArgs(['t.json', '--help'])).toEqual({ templatePath: 't.json', all: false, help: true });
    expect(parseValidateTemplateArgs(['--ruleset', '-h'])).toEqual({ rulesetName: '-h', all: false, help: false });
  });

  it('reads the template positional, last one winning', () => {
    expect(parseValidateTemplateArgs([])).toEqual({ all: false, help: false });
    expect(parseValidateTemplateArgs(['template.json'])).toEqual({ templatePath: 'template.json', all: false, help: false });
    expect(parseValidateTemplateArgs(['a.json', 'b.json'])).toEqual({ templatePath: 'b.json', all: false, help: false });
  });

  it('reads every option', () => {
    expect(parseValidateTemplateArgs(['t.json', '--ruleset', 'Security Rules', '--tag', 'prod', '--all'])).toEqual({
      templatePath: 't.json',
      rulesetName: 'Security Rules',
      tag: 'prod',
      all: true,
      help: false,
    });
  });

  it('ignores a value option that has no value', () => {
    expect(parseValidateTemplateArgs(['t.json', '--ruleset'])).toEqual({ templatePath: 't.json', all: false, help: false });
    expect(parseValidateTemplateArgs(['t.json', '--tag', ''])).toEqual({ templatePath: '', all: false, help: false });
  });
});

describe('guido-schema-to-guido arguments', () => {
  it('flags help only for a help token that is not an option value', () => {
    expect(parseSchemaToGuidoArgs(['--help'])).toMatchObject({ help: true });
    expect(parseSchemaToGuidoArgs(['-o', '-h', 's.json'])).toMatchObject({ output: '-h', schemaFile: 's.json', help: false });
  });

  it('reads short options', () => {
    expect(parseSchemaToGuidoArgs(['s.json', '-o', 'out.json', '-n', 'Name', '-v', '2.0.0', '--stdout'])).toEqual({
      schemaFile: 's.json',
      output: 'out.json',
      name: 'Name',
      version: '2.0.0',
      stdout: true,
      help: false,
    });
  });

  it('reads long options', () => {
    expect(
      parseSchemaToGuidoArgs([
        '--output', 'o.json', '--name', 'N', '--version', '1', '--owner', 'me', '--filename', 'app.json',
        '--application', 'app', '--docs', 'https://d', '--command', 'run', '--ruleset-name', 'Schema Rules',
        '--ruleset-tags', ' auto , schema', 'first.json', 'last.json',
      ])
    ).toEqual({
      schemaFile: 'last.json',
      output: 'o.json',
      name: 'N',
      version: '1',
      owner: 'me',
      fileName: 'app.json',
      application: 'app',
      docs: 'https://d',
      command: 'run',
      rulesetName: 'Schema Rules',
      rulesetTags: ['auto', 'schema'],
      stdout: false,
      help: false,
    });
  });

  it('takes the token after a value option verbatim', () => {
    expect(parseSchemaToGuidoArgs(['s.json', '-o', ''])).toEqual({ schemaFile: 's.json', output: '', stdout: false, help: false });
    expect(parseSchemaToGuidoArgs(['s.json', '--ruleset-tags', 'a', '--ruleset-tags'])).toEqual({ schemaFile: 's.json', stdout: false, help: false });
  });
});

describe('guido-to-schema arguments', () => {
  it('flags help only for a help token that is not an option value', () => {
    expect(parseGuidoToSchemaArgs(['-h'])).toEqual({ stdout: false, help: true });
    expect(parseGuidoToSchemaArgs(['--id', '--help', 'g.json'])).toEqual({ guidoFile: 'g.json', $id: '--help', stdout: false, help: false });
  });

  it('reads every option, last positional winning', () => {
    expect(parseGuidoToSchemaArgs(['a.json', 'g.json', '-o', 'out.json', '--id', 'urn:x', '--draft', '2020-12', '--stdout'])).toEqual({
      guidoFile: 'g.json',
      output: 'out.json',
      $id: 'urn:x',
      draft: '2020-12',
      stdout: true,
      help: false,
    });
    expect(parseGuidoToSchemaArgs(['g.json', '--output', 'o.json'])).toMatchObject({ output: 'o.json' });
  });

  it('keeps the last supported draft and skips others', () => {
    expect(parseGuidoToSchemaArgs(['g.json', '--draft', '04'])).toEqual({ guidoFile: 'g.json', stdout: false, help: false });
    expect(parseGuidoToSchemaArgs(['g.json', '--draft', '07', '--draft', '04'])).toMatchObject({ draft: '07' });
    expect(parseGuidoToSchemaArgs(['g.json', '--draft', '07', '--draft', '2020-12'])).toMatchObject({ draft: '2020-12' });
  });
});
