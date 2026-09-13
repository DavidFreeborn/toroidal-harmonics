const {execFileSync}=require('node:child_process');
const path=require('node:path');
for(const script of ['verify-presets.cjs','verify-guide.cjs','verify-runtime.cjs','verify-revivals.cjs','verify-spinor.cjs','verify-phason.cjs','verify-scheduling.cjs','verify-preparation.cjs','verify-geometry-preparation.cjs','verify-edge-continuity.cjs','verify-frame-joints.cjs','verify-asset-cache.cjs']){
 execFileSync(process.execPath,[path.join(__dirname,script)],{stdio:'inherit'});
}
