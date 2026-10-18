import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css=readFileSync(new URL('../experience.css',import.meta.url),'utf8');
const luminance=(hex:string)=>hex.match(/[a-f\d]{2}/gi)!.map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
test('experience themes retain readable action text and keyboard/reduced-motion support',()=>{
  for(const [background,foreground] of [['08775d','ffffff'],['bce86b','172412'],['d7f36b','1e321d']]) {
    const values=[luminance(background),luminance(foreground)].sort((a,b)=>b-a);
    assert.ok((values[0]+.05)/(values[1]+.05)>=4.5);
  }
  assert.match(css,/@media screen\s*\{/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/button:disabled/);
  assert.match(css,/min-height:42px/);
  assert.doesNotMatch(css,/@media print/);
});
