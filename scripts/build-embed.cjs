/* The preview uses the production renderer and controls internally. Only its
   canvas is presented; renderer families are loaded on demand in embed mode. */
const fs=require('node:fs'),assert=require('node:assert/strict');
let html=fs.readFileSync('dist/index.html','utf8');
const core=new Set(['programs','lightfield','performance','eigenmodes','presets','collection','parameters','selection','artwork']);
html=html.replace(/<script defer src="\.\/([a-z-]+)\.js\?v=\d+"><\/script>/g,(tag,name)=>core.has(name)?tag:'');
html=html.replace('<title>Toroidal harmonics</title>','<title>Toroidal harmonics · Preview</title>');
html=html.replace('</head>',`<meta name="robots" content="noindex, follow">
<style>#artwork > :not(#field){display:none!important}#field{touch-action:pan-y}</style>
<script>window.TORUS_EMBED=true;</script>
</head>`);
assert.equal([...html.matchAll(/<script defer /g)].length,core.size);
html=html.replace(/^[\t ]+$/gm,'');
fs.writeFileSync('dist/embed.html',html);
console.log('Built canvas-only preview with nine core scripts and on-demand renderers.');
