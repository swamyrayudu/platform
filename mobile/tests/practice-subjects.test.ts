import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRACTICE_SUBJECTS, websitePracticeSubject } from '../utils/practice-subjects';

test('mobile practice offers exactly the website subject groups, order and Telugu labels',()=>{
  const website=readFileSync(new URL('../../app/components/dsc-sgt/practice/setup/SubjectSelector.tsx',import.meta.url),'utf8');
  const catalog=website.slice(website.indexOf('export const SUBJECT_LIST'),website.indexOf('interface SubjectSelectorProps'));
  const subjects=Array.from(catalog.matchAll(/\bname: '([^']+)',\s*teluguName: '([^']+)'/g),match=>({name:match[1],teluguName:match[2]}));
  assert.equal(subjects.length,7);
  assert.deepEqual(PRACTICE_SUBJECTS,subjects);
});
test('bank aliases reuse website groups and unrelated subjects cannot be selected through links',()=>{
  for(const subject of PRACTICE_SUBJECTS){
    assert.equal(websitePracticeSubject(subject.name.toUpperCase()),subject.name);
    assert.equal(websitePracticeSubject(subject.teluguName),subject.name);
  }
  for(const alias of ['Pedagogy','Educational Psychology','Perspectives in Education'])assert.equal(websitePracticeSubject(alias),'Educational Psychology + Perspectives in Education');
  assert.equal(websitePracticeSubject('General Knowledge'),'GK & Current Affairs');
  assert.equal(websitePracticeSubject('సైన్స్'),'Science');
  assert.equal(websitePracticeSubject(' Maths '),'Mathematics');
  for(const extra of ['All','Hindi','Computer Science','constructor','toString','__proto__',undefined])assert.equal(websitePracticeSubject(extra),null);
});
