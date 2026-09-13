/* Shader readiness and bounded, cooperative first-draw preparation. */
const TorusPrograms=(()=>{
 const contexts=new WeakMap();
 function context(gl){
  let value=contexts.get(gl);
  if(!value){const extension=gl.getExtension('KHR_parallel_shader_compile');value={extension:extension&&typeof extension.COMPLETION_STATUS_KHR==='number'?extension:null,programs:new Map(),pending:0,stage:null,staging:Promise.resolve()};contexts.set(gl,value);}
  return value;
 }
 function nextFrame(){return new Promise(resolve=>{
  // A hidden page does not deliver RAF callbacks. Context-loss/fence waiters
  // must still settle, including a tab hidden during an incoming selection.
  if(typeof document!=='undefined'&&document.hidden&&typeof setTimeout==='function')setTimeout(resolve,32);
  else requestAnimationFrame(resolve);
 });}
 function link(gl,vertex,fragment){
  const state=context(gl),key=vertex+'\0'+fragment;
  if(state.programs.has(key))return state.programs.get(key);
  const task=(async()=>{
   const program=gl.createProgram(),shaders=[];state.pending++;
   try{
    if(!program)throw Error('Unable to allocate a graphics program');
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
     const shader=gl.createShader(type);if(!shader)throw Error('Unable to allocate a shader');shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);gl.attachShader(program,shader);
    }
    gl.linkProgram(program);
    if(state.extension)while(!gl.getProgramParameter(program,state.extension.COMPLETION_STATUS_KHR)){
     if(gl.isContextLost())throw Error('Graphics context lost during compilation');
     await nextFrame();
    }
    if(gl.isContextLost())throw Error('Graphics context lost during compilation');
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||shaders.map(s=>gl.getShaderInfoLog(s)).join('\n'));
    return program;
   }catch(error){if(program)gl.deleteProgram(program);throw error;}
   finally{state.pending--;for(const shader of shaders)gl.deleteShader(shader);}
  })();
  state.programs.set(key,task);
  // Failures can be retried; a rejected promise is never a permanent cache hit.
  task.catch(()=>{if(state.programs.get(key)===task)state.programs.delete(key);});
  return task;
 }
 function specialize(source,constants){
  // Retain dynamic scientific parameters, but make a renderer's study identity
  // a compile-time constant. ANGLE can discard unrelated recursive branches
  // before translating/inlining their considerably larger pixel filters.
  const names=Object.keys(constants),found=new Set();
  for(const name of names)if(!/^[A-Za-z_]\w*$/.test(name)||!Number.isInteger(constants[name])||constants[name]<-2147483648||constants[name]>2147483647)throw Error('Shader identity must be a named 32-bit integer');
  const result=source.replace(/\buniform\s+((?:(?:lowp|mediump|highp)\s+)?int)\s+([^;]+);/g,(declaration,type,list)=>{
   const dynamic=[],fixed=[];
   for(const name of list.split(',').map(value=>value.trim())){
    if(Object.prototype.hasOwnProperty.call(constants,name)){fixed.push('const '+type+' '+name+'='+constants[name]+';');found.add(name);}else dynamic.push(name);
   }
   return (dynamic.length?'uniform '+type+' '+dynamic.join(',')+';\n':'')+fixed.join('\n');
  });
  for(const name of names)if(!found.has(name))throw Error('No integer uniform found for '+name);
  return result;
 }
 async function afterGPU(gl){
  if(typeof gl.fenceSync!=='function'||typeof gl.SYNC_GPU_COMMANDS_COMPLETE!=='number')return;
  if(gl.isContextLost())throw Error('Graphics context lost during preparation');
  const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!fence)return;
  gl.flush();
  try{
   for(;;){
    if(gl.isContextLost())throw Error('Graphics context lost during preparation');
    const status=gl.clientWaitSync(fence,0,0);
    if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return;
    if(status===gl.WAIT_FAILED)throw Error('Graphics preparation fence failed');
    await nextFrame();
   }
  }finally{gl.deleteSync(fence);}
 }
 function stage(gl,draw,width=256,height=256){
  const state=context(gl);
  const task=state.staging.catch(()=>{}).then(async()=>{
   const divisor=Math.max(1,width/256,height/256),w=Math.max(1,Math.round(width/divisor)),h=Math.max(1,Math.round(height/divisor));
   const framebuffer=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),renderbuffer=gl.getParameter(gl.RENDERBUFFER_BINDING),viewport=gl.getParameter(gl.VIEWPORT);
   let target=state.stage;
   try{
    if(gl.isContextLost())throw Error('Graphics context lost during preparation');
    if(!target){target={framebuffer:gl.createFramebuffer(),colour:gl.createRenderbuffer(),depth:gl.createRenderbuffer(),width:0,height:0,samples:gl.getParameter(gl.SAMPLES)||0,depthFormat:gl.getParameter(gl.DEPTH_BITS)>=24?gl.DEPTH_COMPONENT24:gl.DEPTH_COMPONENT16};state.stage=target;}
    gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
    if(target.width!==w||target.height!==h){
     const storage=(buffer,format,attachment)=>{gl.bindRenderbuffer(gl.RENDERBUFFER,buffer);if(target.samples)gl.renderbufferStorageMultisample(gl.RENDERBUFFER,target.samples,format,w,h);else gl.renderbufferStorage(gl.RENDERBUFFER,format,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,attachment,gl.RENDERBUFFER,buffer);};
     storage(target.colour,gl.RGBA8,gl.COLOR_ATTACHMENT0);storage(target.depth,target.depthFormat,gl.DEPTH_ATTACHMENT);
     if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Unable to prepare the artwork framebuffer');
     target.width=w;target.height=h;
    }
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const result=draw();if(result&&typeof result.then==='function')throw Error('Preparation draw must be synchronous');
   }finally{
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,framebuffer);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);gl.bindRenderbuffer(gl.RENDERBUFFER,renderbuffer);gl.viewport(...viewport);
   }
   await afterGPU(gl);return {width:w,height:h};
  });
  state.staging=task;return task;
 }
 // One preparation job at a time. The owner supplies real rendering headroom
 // and visibility; an idle callback alone says nothing about GPU availability.
 function idleQueue({canRun=()=>true,onError=()=>{}}={}){
  const jobs=new Map();let running=null,idle=null,timer=null,disposed=false,order=0;
  function later(){if(!disposed&&jobs.size&&!timer)timer=setTimeout(()=>{timer=null;kick();},250);}
  function kick(){
   if(disposed||running||idle!==null||!jobs.size)return;
   if(!canRun()){later();return;}
   const run=deadline=>{
    idle=null;if(disposed||running||!jobs.size)return;
    if(!canRun()||deadline&&!deadline.didTimeout&&deadline.timeRemaining()<4){later();return;}
    let next=null;for(const job of jobs.values())if(!next||job.priority>next.priority||job.priority===next.priority&&job.order<next.order)next=job;
    jobs.delete(next.key);running=next;
    Promise.resolve().then(next.task).then(next.resolve,error=>{next.reject(error);try{onError(error,next.key);}catch{}}).finally(()=>{running=null;later();});
   };
   if(typeof requestIdleCallback==='function')idle=requestIdleCallback(run,{timeout:2000});
   else idle=setTimeout(()=>run(null),32);
  }
  return {
   get pending(){return jobs.size+(running?1:0);},get active(){return running?.key??null;},
   enqueue(key,task,priority=0){
    if(disposed)return Promise.resolve(false);
    const existing=jobs.get(key)||(running?.key===key?running:null);if(existing){existing.priority=Math.max(priority,existing.priority);return existing.promise;}
    const job={key,task,priority,order:order++};job.promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject;});job.promise.catch(()=>{});jobs.set(key,job);kick();return job.promise;
   },
   promote(key,priority=1){const job=jobs.get(key);if(job)job.priority=Math.max(priority,job.priority);kick();},
   cancel(key){const job=jobs.get(key);if(job){jobs.delete(key);job.resolve(false);}},kick,
   dispose(){disposed=true;if(timer!==null)clearTimeout(timer);if(idle!==null){if(typeof cancelIdleCallback==='function')cancelIdleCallback(idle);else clearTimeout(idle);}for(const job of jobs.values())job.resolve(false);jobs.clear();}
  };
 }
 return {link,specialize,parallel:gl=>Boolean(context(gl).extension),pending:gl=>context(gl).pending,afterGPU,stage,idleQueue};
})();
