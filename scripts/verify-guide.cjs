const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const {topics,influences,studies}=require('./guide-content.cjs'),c={};
vm.runInNewContext(fs.readFileSync('dist/presets.js','utf8')+fs.readFileSync('dist/collection.js','utf8')+';this.ids=TORUS_COLLECTION.flatMap(g=>g.studies.map(s=>s[0]));',c);
// --generated validates the next release in memory, leaving dist untouched.
const html=process.argv.includes('--generated')?require('./build-guide.cjs').html:fs.readFileSync('dist/readme.html','utf8');
const {document}=parseHTML(html);
assert.equal(document.querySelectorAll('article').length,c.ids.length);
for(const id of c.ids){
 const article=document.getElementById('study-'+id);assert(article,'Guide missing study '+id);
 assert.equal(article.querySelector('h3 a').getAttribute('href'),'./?study='+id);
 assert.equal(article.querySelector('p').textContent,studies[id][0]);
 for(const key of studies[id][1])assert(article.textContent.includes(topics[key][0]));
 assert.equal(article.querySelectorAll('p').length,2,'Each study has one note and one mathematical reference line');
 assert(!article.textContent.includes('Artistic references:'),'Artist references should not repeat per study');
 const referenceURLs=[...article.querySelectorAll('.references a')].map(a=>a.getAttribute('href'));
 assert.deepEqual(referenceURLs,studies[id][1].map(key=>topics[key][2]),'Study links should contain only its mathematical references');
}
const urls=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
for(const [,note,url] of [...Object.values(topics),...Object.values(influences)]){assert(urls.includes(url));assert(note.split(/\s+/).length<=25);assert.equal(new URL(url).protocol,'https:');}
assert.equal(document.querySelectorAll('#concepts dt').length,40,'Retain every requested mathematical concept');
assert.equal(document.querySelectorAll('#influences').length,1,'Use one global artistic influences section');
assert.equal(document.querySelectorAll('#influences dt').length,5,'Retain all five named artistic influences');
for(const [name,note,url] of Object.values(influences)){
 assert.equal(urls.filter(value=>value===url).length,1,'Artist should be linked once: '+name);
 assert(document.querySelector('#influences').textContent.includes(name));
 assert(document.querySelector('#influences').textContent.includes(note));
}
assert(!document.querySelector('footer p'),'Do not repeat artwork instructions in the guide footer');
assert.equal(document.querySelectorAll('.intro').length,1,'Keep the introductory text concise');
assert(!document.querySelector('iframe'),'Guide should load without embedded external content');
assert(document.querySelector('label[for="study-search"]'));assert(document.querySelector('#search-result[role="status"]'));
console.log('PASS '+c.ids.length+' concise study notes, '+Object.keys(topics).length+' linked concepts and '+Object.keys(influences).length+' global artistic influences');
