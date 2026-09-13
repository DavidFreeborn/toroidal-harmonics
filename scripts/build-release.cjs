/* Inventory the complete static release for independent, verified website copies. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../dist'),files=[];
function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
 const file=path.join(folder,entry.name),name=path.relative(root,file).split(path.sep).join('/');
 if(entry.isDirectory())visit(file);else if(name!=='release.json'){
  const data=fs.readFileSync(file);files.push({path:name,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
 }
}}
visit(root);fs.writeFileSync(path.join(root,'release.json'),JSON.stringify({revision:23,files},null,2)+'\n');
console.log('Release 23: '+files.length+' files, '+(files.reduce((sum,file)=>sum+file.bytes,0)/1048576).toFixed(2)+' MiB.');
