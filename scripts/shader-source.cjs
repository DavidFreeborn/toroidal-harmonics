// Return exactly the fragment source compiled in the browser, including shared light.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.join(__dirname,'../dist');
const file=process.argv[2],stage=process.argv[3],code=fs.readFileSync(path.join(root,file),'utf8');
const match=code.match(new RegExp('const\\s+'+stage+'Source\\s*=\\s*`([\\s\\S]*?)`;'));
if(!match)throw Error('Missing '+stage+' source in '+file);
let source=match[1];
if(stage==='fragment'&&code.includes('TorusLight.fragment')){const ctx={};vm.runInNewContext(fs.readFileSync(path.join(root,'lightfield.js'),'utf8')+';this.Light=TorusLight',ctx);source=ctx.Light.fragment(source,['kinetic.js','sculptures.js','chiaroscuro.js','mechanisms.js','quasicrystal.js','spinor.js'].includes(file));}
process.stdout.write(source);
