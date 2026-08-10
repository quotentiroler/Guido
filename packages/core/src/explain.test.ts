import { describe, it, expect } from 'vitest';
import { RuleState, type Field, type Rule } from '@quotentiroler/guido-types';
import { explainField } from './explain.js';

const f = (name: string, value: Field['value'] = '', checked = false, range = ''): Field => ({
  name, value, checked, info: '', example: '', range,
});

describe('explainField', () => {
  it('traces the rule chain and root cause for a required field', () => {
    const fields = [
      f('Repository', 'MongoDb', true, 'MongoDb||SQLite'),
      f('MongoDbOptions.ConnectionString', '', false, 'string'),
      f('Replication', '', false, 'boolean'),
    ];
    const rules: Rule[] = [
      { conditions: [{ name: 'Repository', state: RuleState.SetToValue, value: 'MongoDb' }], targets: [{ name: 'MongoDbOptions.ConnectionString', state: RuleState.SetToValue, value: 'mongodb://localhost' }] },
      { conditions: [{ name: 'MongoDbOptions.ConnectionString', state: RuleState.Set }], targets: [{ name: 'Replication', state: RuleState.Set }] },
    ];

    const ex = explainField('Replication', fields, rules);

    expect(ex.outcome).toBe('required');
    expect(ex.because).toHaveLength(1);
    expect(ex.because[0].ruleIndex).toBe(2); // 1-based

    const cond = ex.because[0].conditions[0];
    expect(cond.satisfiedBy).toBe('rule');
    // recurse one level to the root cause
    const rootCond = cond.chain?.because[0].conditions[0];
    expect(rootCond?.satisfiedBy).toBe('input');
    expect(rootCond?.text).toContain('Repository');
  });

  it('explains a numeric-condition requirement', () => {
    const fields = [f('Port', '443', true, 'integer'), f('Tls', '', false, 'boolean')];
    const rules: Rule[] = [
      { conditions: [{ name: 'Port', state: RuleState.LessThan, value: '1024' }], targets: [{ name: 'Tls', state: RuleState.Set }] },
    ];

    const ex = explainField('Tls', fields, rules);

    expect(ex.outcome).toBe('required');
    expect(ex.because[0].conditions[0].satisfiedBy).toBe('input');
    expect(ex.because[0].conditions[0].text.toLowerCase()).toContain('less than');
  });

  it('reports an unconstrained field (no rule forces it)', () => {
    const ex = explainField('Foo', [f('Foo', 'x', true)], []);
    expect(ex.outcome).toBe('unconstrained');
    expect(ex.because).toHaveLength(0);
  });
});
