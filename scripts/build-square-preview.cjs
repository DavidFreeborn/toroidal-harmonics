/* Capture the actual curated artwork at the profile preview's square aspect.
   Export through the browser's WebP encoder; no rendered UI or external images. */
const fs=require('node:fs'),path=require('node:path');
const {open}=require('./browser-audit.cjs');
async function main(){
 const app=await open(path.resolve('dist'),{background:false,phase:.8,viewport:{width:260,height:260},dpr:2});
 try{
  await app.select(145);await app.page.addStyleTag({content:'#artwork > :not(#field){display:none!important}'});await app.settle();
  const png=await app.page.screenshot();
  const webp=await app.page.evaluate(async bytes=>{
   const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
   const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
   canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();return canvas.toDataURL('image/webp',.95).split(',')[1];
  },Array.from(png));
  if(app.errors.length)throw Error(app.errors.join('\n'));
  const data=Buffer.from(webp,'base64');fs.writeFileSync('dist/preview-square.webp',data);
  console.log('Captured 520×520 Talbot Cathedral profile poster: '+data.length+' bytes.');
 }finally{await app.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
