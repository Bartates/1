import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Feature: android-build-optimization
// Task 6.2: .gitignore ve .env.example güvenlik yapılandırması doğrulaması
// Requirements: 6.1, 7.1, 7.2, 7.3

const GITIGNORE_PATH = resolve(process.cwd(), '.gitignore');
const ENV_EXAMPLE_PATH = resolve(process.cwd(), '.env.example');

describe('.gitignore security rules', () => {
  const gitignore = readFileSync(GITIGNORE_PATH, 'utf-8');

  test('contains google-services.json entry', () => {
    expect(gitignore).toContain('google-services.json');
  });

  test('contains .env entry', () => {
    // Match standalone `.env` line (not just `.env.local` etc.)
    expect(gitignore).toMatch(/^\.env$/m);
  });
});

describe('.env.example required variables', () => {
  const envExample = readFileSync(ENV_EXAMPLE_PATH, 'utf-8');

  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_GEMINI_API_KEY',
  ];

  for (const varName of requiredVars) {
    test(`contains ${varName}`, () => {
      expect(envExample).toContain(varName);
    });
  }
});
