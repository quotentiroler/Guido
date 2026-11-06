import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readSpring } from './spring.js';

let dir = '';

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'guido-spring-'));
  writeFileSync(
    join(dir, 'application.properties'),
    ['spring.datasource.username=${DB_USERNAME:root}', 'spring.datasource.password=${DB_PASSWORD}', 'app.secret=${JWT_SECRET:dev-secret}', 'server.port=8080'].join('\n')
  );
  writeFileSync(join(dir, 'application-production.properties'), ['app.secret=${JWT_SECRET}', 'mail.host=${MAIL_HOST:smtp.example.org}'].join('\n'));
  writeFileSync(join(dir, 'application-e2e.yml'), 'app:\n  baseUrl: ${APP_BASE_URL:http://localhost:8080}\n  secret: ${JWT_SECRET:}\n');
});

describe('spring source', () => {
  it('reads the base config with placeholder defaults', () => {
    const settings = readSpring({ dir });
    expect(settings.values).toEqual({ SPRING_PROFILES_ACTIVE: 'default', DB_USERNAME: 'root', JWT_SECRET: 'dev-secret' });
    expect(settings.deployTime.size).toBe(0);
  });

  it('layers a profile so a placeholder without default leaves the variable unset', () => {
    expect(readSpring({ dir, profiles: ['production'] }).values).toEqual({
      SPRING_PROFILES_ACTIVE: 'production',
      DB_USERNAME: 'root',
      MAIL_HOST: 'smtp.example.org',
    });
  });

  it('reads yml profiles and can omit the profile variable', () => {
    expect(readSpring({ dir, profiles: ['e2e'], profileVariable: false }).values).toEqual({
      DB_USERNAME: 'root',
      APP_BASE_URL: 'http://localhost:8080',
    });
  });

  it('fails when no config exists', () => {
    expect(() => readSpring({ dir, name: 'missing' })).toThrow('No missing.properties');
  });
});
