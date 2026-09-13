/* Build a small, readable guide from one note per visible study. No runtime dependency. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {topics,influences,studies}=require('./guide-content.cjs'),c={};
vm.runInNewContext(fs.readFileSync('dist/presets.js','utf8')+fs.readFileSync('dist/collection.js','utf8')+';this.groups=TORUS_COLLECTION;',c);
const source=fs.readFileSync('dist/artwork.js','utf8');
vm.runInNewContext(source.slice(source.indexOf('const studyArchive='),source.indexOf('const collectionEntries='))+'this.archive=studyArchive;',c);
const escape=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const link=([title,,url])=>`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(title)}</a>`;
let count=0;
const groups=c.groups.map(group=>`<details class="study-group"><summary>${escape(group.name)} <span>${group.studies.length}</span></summary>\n${group.studies.map(([id])=>{
 const note=studies[id],title=c.archive.find(x=>x[2]===id)?.[0];assert(note&&title,'Missing guide: '+id);
 assert(note[0].split(/\s+/).length<=24,'Keep explanations short: '+id);count++;
 const references=note[1].map(key=>{assert(topics[key]);return link(topics[key]);});
 const artists=note[2].map(key=>{assert(influences[key]);return link(influences[key]);});
 return `<article id="study-${id}" tabindex="-1"><h3><a href="./?study=${id}">${escape(title)}</a></h3><p>${escape(note[0])}</p><p class="references">${references.join(' · ')}<br><span>Artistic references:</span> ${artists.join(' · ')}</p></article>`;
}).join('\n')}</details>`).join('\n');
const glossary=Object.values(topics).map(topic=>`<div><dt>${link(topic)}</dt><dd>${escape(topic[1])}</dd></div>`).join('\n');
const artists=Object.values(influences).map(artist=>`<div><dt>${link(artist)}</dt><dd>${escape(artist[1])}</dd></div>`).join('\n');
fs.writeFileSync('dist/readme.html',`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Toroidal harmonics · Readme</title><meta name="description" content="Very short explanations and linked mathematical and artistic references for ${count} toroidal studies.">
<link rel="stylesheet" href="./readme.css?v=23"><script defer src="./readme.js?v=23"></script></head>
<body><main><nav class="back"><a href="./">← Artwork</a></nav><h1>Toroidal harmonics <span>Readme</span></h1>
<p class="intro">One line per study. Follow the links for the mathematics; click a title to open the artwork.</p>
<p class="intro">Artistic references describe the collection’s visual influences.</p>
<details id="concepts"><summary>Mathematical concepts</summary><dl>${glossary}</dl></details>
<details id="influences"><summary>Artistic influences</summary><dl>${artists}</dl><p class="credit">Reptile outline adapted from <a href="https://www.seanmichaelragan.com/files/MC_Escher_single_lizard_tile.svg">Sean Michael Ragan’s Escher lizard tile</a>.</p></details>
<section aria-labelledby="studies-heading"><h2 id="studies-heading">The studies <span>${count}</span></h2>
<label for="study-search">Find a study or concept</label><input id="study-search" type="search" placeholder="e.g. eyes, Talbot, Penrose" autocomplete="off">
<p id="search-result" role="status" hidden></p>${groups}</section>
<footer><p>Random changes study. Extra random varies its parameters. Space pauses. Parameters contains the construction choices.</p><a href="./">Return to artwork</a></footer>
</main></body></html>\n`);
console.log('Built concise guide for '+count+' studies and '+Object.keys(topics).length+' concepts.');
