import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const readPublished=path=>readFileSync(new URL(`../../app/${path}`,import.meta.url),'utf8');

test('voice search uses native Expo recognition and starts browser recognition directly from the click gesture',()=>{
  const app=read('App.tsx');
  assert.match(app,/from 'expo-speech-recognition'/);
  assert.match(app,/ExpoSpeechRecognitionModule\.requestPermissionsAsync\(\)/);
  assert.match(app,/ExpoSpeechRecognitionModule\.isRecognitionAvailable\(\)/);
  assert.match(app,/useSpeechRecognitionEvent\('result'/);
  assert.match(app,/useSpeechRecognitionEvent\('error'/);
  assert.match(app,/useSpeechRecognitionEvent\('volumechange'/);
  assert.match(app,/getBrowserSpeechRecognition/);
  assert.match(app,/if\(Platform\.OS==='web'\)/);
  assert.match(app,/const recognition=new SpeechRecognitionClass\(\)/);
  assert.match(app,/try\{recognition\.start\(\);\}/);
  assert.match(app,/webRecognition\.current\?\.abort\(\)/);
});

test('voice recognition is language aware and writes live transcripts into product search',()=>{
  const app=read('App.tsx');
  assert.match(app,/language==='fr'\?'fr-FR':language==='ar'\?'ar-MA':'en-US'/);
  assert.match(app,/const transcript=event\.results\[0\]\?\.transcript/);
  assert.match(app,/if\(transcript\)\{setQuery\(transcript\)/);
  assert.match(app,/contextualStrings:\['IPORDISE','Jean Paul Gaultier','Yves Saint Laurent'/);
  assert.match(app,/EXTRA_LANGUAGE_MODEL:'web_search'/);
  assert.match(app,/accessibilityLiveRegion="polite"/);
});

test('native build config declares speech services and a specific microphone purpose',()=>{
  const config=JSON.parse(read('app.json')).expo;
  const speechPlugin=config.plugins.find(entry=>Array.isArray(entry)&&entry[0]==='expo-speech-recognition');
  const imagePickerPlugin=config.plugins.find(entry=>Array.isArray(entry)&&entry[0]==='expo-image-picker');
  assert.ok(speechPlugin);
  assert.notEqual(imagePickerPlugin?.[1]?.microphonePermission,false,'image picker must not remove RECORD_AUDIO required by voice search');
  assert.match(speechPlugin[1].microphonePermission,/fragrance voice search/i);
  assert.match(speechPlugin[1].speechRecognitionPermission,/voice into fragrance search text/i);
  assert.ok(speechPlugin[1].androidSpeechServicePackages.includes('com.google.android.googlequicksearchbox'));
  assert.ok(speechPlugin[1].androidSpeechServicePackages.includes('com.google.android.tts'));
  assert.equal(config.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'),false);
});

test('published app renders only the React voice-search microphone',()=>{
  const html=readPublished('index.html');
  assert.doesNotMatch(html,/voice-search\.js/);
  assert.doesNotMatch(html,/ipo-voice-search-button/);
});
