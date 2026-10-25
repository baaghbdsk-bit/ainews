import assert from 'node:assert/strict';
import { isAdmin, isEditor } from '../src/lib/auth/editor.ts';

const adminUser = { app_metadata: { role: 'admin' } };
const editorUser = { app_metadata: { role: 'editor' } };
const readerUser = { app_metadata: { role: 'reader' } };
const guest = null;

assert.equal(isAdmin(adminUser), true, 'admin role is admin');
assert.equal(isAdmin(editorUser), true, 'editor role is treated as admin');
assert.equal(isAdmin(readerUser), false, 'ordinary reader is not admin');
assert.equal(isAdmin(guest), false, 'guest is not admin');
assert.equal(isEditor(editorUser), true, 'editor role is editor');
assert.equal(isEditor(adminUser), false, 'admin role is not editor');

console.log('ADMIN AUTH TESTS: PASS');
