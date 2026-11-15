import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const html=await readFile('dist/public/index.html','utf8');
const paths=[...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.js)"/g)].map(m=>m[1]))];
const files=await Promise.all(paths.map(async path=>{const data=await readFile('dist/public'+path);return {path,bytes:data.length,gzip:gzipSync(data).length}}));
const report={initial_js:files,bytes:files.reduce((sum,f)=>sum+f.bytes,0),gzip:files.reduce((sum,f)=>sum+f.gzip,0)};
if(files.some(f=>/\/(maps|supabase)-/.test(f.path)))throw new Error('Entry page must not preload the map engine or account SDK');
await mkdir('output/performance-audit',{recursive:true});await writeFile('output/performance-audit/current-bundle.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
