const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const {topics,influences,studies}=require('./guide-content.cjs'),c={};
vm.runInNewContext(fs.readFileSync('dist/presets.js','utf8')+fs.readFileSync('dist/collection.js','utf8')+';this.ids=TORUS_COLLECTION.flatMap(g=>g.studies.map(s=>s[0]));',c);
const {document}=parseHTML(fs.readFileSync('dist/readme.html','utf8'));
assert.equal(document.querySelectorAll('article').length,c.ids.length);
for(const id of c.ids){
 const article=document.getElementById('study-'+id);assert(article,'Guide missing study '+id);
 assert.equal(article.querySelector('h3 a').getAttribute('href'),'./?study='+id);
 assert.equal(article.querySelector('p').textContent,studies[id][0]);
 for(const key of studies[id][1])assert(article.textContent.includes(topics[key][0]));
 for(const key of studies[id][2])assert(article.textContent.includes(influences[key][0]));
}
const urls=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
for(const [,note,url] of [...Object.values(topics),...Object.values(influences)]){assert(urls.includes(url));assert(note.split(/\s+/).length<=25);assert.equal(new URL(url).protocol,'https:');}
assert(!document.querySelector('iframe'),'Guide should load without embedded external content');
assert(document.querySelector('label[for="study-search"]'));assert(document.querySelector('#search-result[role="status"]'));
console.log('PASS '+c.ids.length+' concise study notes, '+Object.keys(topics).length+' linked concepts and '+Object.keys(influences).length+' artistic references');
