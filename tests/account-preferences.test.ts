import test from 'node:test';
import assert from 'node:assert/strict';
import { accountPreferences } from '../account-preferences';
import { readFile } from 'node:fs/promises';
test('cloud preferences restore on login; explicit entry choices override them',()=>{
  assert.deepEqual(accountPreferences({language:'kn',theme:'dark'},{language:'en',theme:'light'},{}),{language:'kn',theme:'dark'});
  assert.deepEqual(accountPreferences({language:'kn',theme:'dark'},{language:'hi',theme:'light'},{language:true,theme:true}),{language:'hi',theme:'light'});
  assert.deepEqual(accountPreferences({}, {}, {}),{language:'en',theme:'light'});
  assert.deepEqual(accountPreferences({language:'invalid',theme:'invalid'},{},{}),{language:'en',theme:'light'});
});
test('account screens actually wire cloud preferences, explicit entry choices and the optional OTP flow',async()=>{
  const source=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(source,/accountPreferences\(cloud\.data/);
  assert.match(source,/sessionStorage\.setItem\('rigdesk-entry-language-explicit'/);
  assert.match(source,/if\(emailOtpEnabled\)\{const sent=await sendEmailSignupOtp/);
  assert.match(source,/setStep\('otp'\)/);
  assert.match(source,/href="\/reset-password"/);
  assert.match(source,/if\(adminAccess\)setLocation\('\/admin'\)/);
});
