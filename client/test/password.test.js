import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passwordError, passwordRequirements } from '../src/services/password.js';

test('new password checks characters, UTF-8 byte length, and null characters', () => {
  assert.equal(passwordError('a'.repeat(12), true), '');
  assert.equal(passwordError('🚀'.repeat(18), true), '');
  assert.equal(passwordError('🚀'.repeat(11), true), passwordRequirements);
  assert.equal(passwordError('🚀'.repeat(19), true), passwordRequirements);
  assert.equal(passwordError('a'.repeat(12) + '\0', true), passwordRequirements);
});

test('current password checks validity without applying the new password minimum', () => {
  assert.equal(passwordError('a'), '');
  assert.equal(passwordError(''), 'Enter a valid password.');
  assert.equal(passwordError('a'.repeat(73)), 'Enter a valid password.');
});
