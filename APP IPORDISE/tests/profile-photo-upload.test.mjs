import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const account = await readFile(new URL('../src/account/AccountScreen.tsx', import.meta.url), 'utf8');
const avatarService = await readFile(new URL('../src/services/customerAvatarService.ts', import.meta.url), 'utf8');

test('personal information uses the device photo picker instead of a URL field', () => {
  assert.match(account, /ImagePicker\.launchImageLibraryAsync/);
  assert.match(account, /allowsEditing:\s*true,\s*aspect:\s*\[1,\s*1\]/);
  assert.match(account, />UPLOAD PHOTO<|"UPLOAD PHOTO"/);
  assert.doesNotMatch(account, /label="PROFILE PHOTO[^\n]+<Field/);
});

test('selected profile photos are previewed, validated and uploaded securely', () => {
  assert.match(account, /pendingAvatar\?\.uri/);
  assert.match(account, /5 \* 1024 \* 1024/);
  assert.match(account, /uploadCustomerAvatar\(session\.access_token, session\.user\.id, pendingAvatar\)/);
  assert.match(avatarService, /Authorization: `Bearer \$\{token\}`/);
  assert.match(avatarService, /x-upsert': 'true'/);
});

test('profile photo can be removed and saved without the old avatar reappearing', () => {
  assert.match(account, /const removeProfilePhoto = \(\) =>/);
  assert.match(account, /avatar_url: ""/);
  assert.match(account, /const draftAvatarUrl = profileDraft\?\.avatar_url === undefined \? avatarUrl/);
});
