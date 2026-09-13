/* Controls describe actual constructions, not catalogue categories. Discrete
   geometry uses discrete stops, so adjacent slider positions change the mesh. */
const TorusParameters=(()=>{
 const range=(label,min=0,max=1,step=.01)=>({label,min,max,step});
 const stops=(label,values,labels)=>({label,values,labels:labels||values.map(String)});
 const layers=(label,max=5)=>range(label,1,max,1);
 const palette={label:'Face tones',values:[0,1,2,3],labels:['Porcelain & graphite','Opposing tones','Six greys','Paper & ink']};
 const winding={label:'Winding',values:[0,1,2,3],labels:['Meridians · 1 : 0','Diagonal · 1 : 1','Trefoil · 2 : 3','Long return · 3 : 5']};
 const turns={label:'Turns per flow cycle',values:[1,2,3],labels:['One turn','Two turns','Three turns']};
 const cells=stops('Columns',[44,88,132,176],['12','14','16','18']);
 const chart=stops('Columns',[40,88,180,280],['8','16','24','32']);
 const surface=stops('Tile repeats',[24,48,88,112,136],['8','10','12','16','18']);
 function lighting(s){
  const p={textureMode:{label:'Light choreography'}};
  if(s.textureMode!==0){p.textureStrength=range('Light interplay');if(s.textureStrength!==0)p.textureScale=range('Texture frequency',1,5,1);}
  return p;
 }
 function profile(id,v,s={}){
  // Intrinsic mathematical evolution remains the default; the shared light
  // choreography can be layered over it using the same controls as every study.
  if(id>=145&&id<=148){
   const p={speed:range('Cycle speed',.2,2,.05),perspective:range('Perspective',55,105,1),ink:range('Dark–light contrast'),...lighting(s)};
   if(id<=146){
    p.density=stops('Root repeats',[40,88,136],['2','4','6']);
    if(id===145){p.layers=stops('Fourier order',[4,6,8]);p.wave=range('Rosette lobes');p.turns=stops('Revivals per cycle',[1,2]);}
    else{p.layers=layers('Covering generations',3);p.wave=range('Zero–pole orbit');}
   }else if(id===147){
    p.density=stops('Mechanisms',[40,88,136],['17','23','29']);p.wave=range('Ribbon breadth');
    p.winding=stops('Helical pitch',[0,1,2,3],['1','2','3','5']);p.turns=stops('720° turns per cycle',[1,2,3]);
   }else p.wave=range('Front breadth');
   return p;
  }
  const p={speed:range('Flow speed',.2,2,.05),perspective:range('Perspective',55,105,1),ink:range('Dark–light contrast'),...lighting(s),wave:range('Deformation'),density:range('Density',40,160,4)};
  if(id>=125&&id<=142){
   p.density=stops(id>=135?'Root repeats':'Tile columns',[40,88,136],id>=135?['2','4','6']:['8','16','24']);
   p.winding={label:'Transformation rhythm',values:[0,1,2,3],labels:['Whole chamber','Meridian wave','Braided wave','Hold a form']};
   p.wave=range(id>=135?'Generation delay':id>=130?'Fine engraving':'Surface flex');
   if(id>=135)p.wave.help='Low: generations move together. High: parents lead and smaller forms follow.';
   if(s.winding===3)p.balance=range('Transformation');
   else p.turns={label:'Transformation pace',values:[1,2,3],labels:['1×','2×','3×']};
   if(id>=130&&id<=134){
    p.winding={label:'Transformation rhythm',values:[0,1,2,3,4],labels:['Whole chamber','Meridian wave','Braided wave','Hold a form','Finished creatures']};
    if(s.winding===4)delete p.turns;
   }
   if(id>=135)p.layers=layers('Generations',4);
   if(id>=130&&id<=134&&s.winding===3&&s.balance===0&&![131,134].includes(id))delete p.wave;
   if(id===132)p.density=stops('Reptile clusters',[40,88,136],['2','4','6']);
   if(id===138)p.density=stops('Root columns',[40,88,136],['8','16','24']);
   if(id>=135&&id<=140&&s.layers===1)delete p.wave;
   if(id>=141)p.density=stops('Pentagrid resolution',[88,136,184],['204 rhombi','492 rhombi','1,210 rhombi']);
   if(id>=141&&s.layers===1)p.wave=range('Surface flex');
   if(id>=135&&s.winding===3&&(s.balance===0||s.balance===1)){
    if(id<141)delete p.wave;else p.wave=range('Surface flex');
    if(s.balance===0||id===138||id===142)delete p.layers;
   }
  }else if(id>=101&&id<=120){
   const kind=id-101;
   p.density=stops('Tile columns',[40,88,136],['8','16','24']);p.wave=range('Surface flex');
   if([1,2,3,7].includes(kind))p.density=stops('Tile columns',[40,88,136],['12','24','36']);
   if(kind===5)p.wave=range('Pentagon flex');
   if(kind>=8&&kind<=12)p.wave=range('Edge transformation');
   if(kind>=13){p.density=stops('Root repeats',[40,88,136],['2','4','6']);p.layers=layers('Subdivision depth',4);}
   else if(v>0)p.layers=layers(v===1?'Engraving layers':'Pattern detail',4);
   if(kind===14){p.density=stops('Chair patch repeats',[40,88,136],['1','2','3']);p.layers=layers('Substitution depth',4);}
   if(kind===17)p.wave=range('Partition motion');
  }else if(id>=121&&id<=124){
   p.density=stops('Pentagrid resolution',[40,88,136],['204 rhombi','492 rhombi','1,210 rhombi']);
   p.wave=range('Surface flex');p.turns={label:'Light / partition multiplier',values:[1,2,3],labels:['1×','2×','3×']};
   if(id>=123){p.layers=layers('Subdivision depth',4);p.density=stops('Pentagrid resolution',[88,136,184],['204 rhombi','492 rhombi','1,210 rhombi']);}
   if(id===121&&v===2)p.layers=layers('Golden contours',4);
  }else if((id>=62&&id<=67)||(id>=86&&id<=91)){
   p.density=cells;p.palette=palette;p.turns={label:'Cycle multiplier',values:[1,2,3],labels:['1×','2×','3×']};p.wave=range('Phase modulation');
   if([65,86,87].includes(id))p.wave=range('Expansion');
   if([67,89].includes(id))p.recursion=layers('Recursive levels',3);
   if(id===90)p.recursion=layers('Plate tiers',4);
  }else if((id>=68&&id<=70)||(id>=92&&id<=94)){
   delete p.density;p.turns={label:'Light / fold multiplier',values:[1,2,3],labels:['1×','2×','3×']};p.wave=range([70,92].includes(id)?'Fold amplitude':'Surface deformation');
   if([68,93,94].includes(id))p.layers=layers(id===94?'Woven bands':'Nested contours',4);
  }else if((id>=71&&id<=85)||id>=95){
   p.density=surface;p.winding=winding;
   if([73,75,76,77,78,80,82,85,96,98,99,100].includes(id))p.layers=layers([73,80,82,99].includes(id)?'Contour layers':'Recursive levels',3);
   if(id===74)delete p.density;
   if(id===75||id===82){delete p.wave;}
   if(id===76)p.density=stops('Carpet repeats',[24,88,136],['2','4','6']);
   if(id===77){delete p.wave;p.density=stops('Weave repeats',[24,112,188],['2','4','6']);}
   if(id===78){p.density=stops('Eye columns',[24,48,88,120],['8','12','16','20']);if(v!==0)p.layers=layers('Recursive levels',2);}
   if(id===81){p.density=stops('Weave repeats',[48,88,128],['2','4','6']);p.spectral={label:'Mode family'};delete p.wave;}
   if(id===82)delete p.density;
   if(id===83){p.density=stops('Scale centres',[48,112,212],['1','2','3']);delete p.wave;}
   if(id===84)p.density=stops('Weave repeats',[32,64,88,116,148],['6','8','10','12','14']);
   if(id===95){p.layers=stops('Iteration depth',[12,18,24,30]);p.wave=range('Orbit excursion');p.density=stops('Julia repeats',[24,88,136],['2','4','6']);}
   if(id===96)p.density=stops('Inversion repeats',[24,88,136],['2','4','6']);
   if(id===97)p.density=stops('Nodal repeats',[40,88,168],['2','4','6']);
   if(id===98){p.layers=layers('Folding generations',4);delete p.density;}
   if(id===99)p.density=stops('Critical repeats',[88,128,188],['2','4','6']);
  }else if(id>=54&&id<=61){
   p.density=cells;p.palette=palette;p.turns=turns;p.wave=range('Motion amplitude');
   if(id<60)p.recursion=layers('Recursive levels',[54,59].includes(id)?3:4);
   if(id===56){delete p.wave;delete p.palette;}
   if(id===60){delete p.wave;p.density=stops('Ribbon pairs',[40,120,200],['4','6','8']);}
   if(id===61){delete p.wave;p.winding=winding;p.density=s.winding===2?stops('Cable groups',[88,132,180],['4','5','7']):stops('Cable groups',[44,88,132,176],['3','4','5','6']);if(s.winding===0)delete p.density;}
  }else if([21,22,23,25,27,28].includes(id)){
   p.palette=palette;p.wave=range('Motion amplitude');
   if(id===21){p.turns=turns;p.wave=range('Rolling cadence');p.density=stops('Cube columns',[50,66,88,116,150],['24','26','28','32','36']);}
   if([22,23,25].includes(id))p.palette={label:'Face tones',values:[0,3],labels:['Porcelain & graphite','Paper & ink']};
   if(id===22)p.density=stops('Iris columns',[44,66,88,112,144],['20','22','24','26','28']);
   if(id===23){p.density=stops('Cable groups',[25,50,100,150],['4','5','7','10']);p.wave=range('Cable separation');}
   if(id===25)p.density=stops('Panel columns',[40,80,120,160],['22','26','30','34']);
   if(id===27)p.density=stops('Fold columns',[44,88,132,176],['16','18','20','22']);
   if(id===28)p.density=stops('Woven bundles',[40,120,200],['8','10','12']);
  }else if([0,4,7,10,13,14,15,16,17,18,19,30,34,35,38,39,41,47,49,50,51,53].includes(id)){
   p.winding=winding;p.layers=layers('Contour layers');
   if([0,7,30,35,38,39,49,50,51].includes(id))p.density=chart;
   if([47,49,50,51,53].includes(id))p.layers=layers('Recursive levels',4);
   if([10,18,34,47,53].includes(id))delete p.density;
   if([0,14].includes(id))delete p.layers;
   if(id===53){if(v===2)delete p.layers;else delete p.wave;if(v===1)p.layers=layers('Recursive levels',3);}
   if(id===35)p.layers=layers('Orbital contours',3);
   if(id===49){delete p.layers;p.wave=range('Horizontal sway');}
   if(id===50&&v!==2)delete p.wave;
   if([10,34].includes(id)&&v>=2)p.balance=range('Diagonal coupling');
   if(id===47){delete p.winding;p.balance=range('Focus displacement');}
   if([13,17].includes(id)){p.density=stops('Winding repeats',[40,88,164,240],['2','4','6','8']);p.layers=layers('Strands per bundle');p.layers.labels=['3','5','7','9','11'];if(id===13&&v===1){delete p.layers;delete p.ink;}}
   if(id===15){p.layers=layers('Flow iterations',5);p.density=stops('Filament count',[44,64,88,112,136],['26','34','44','54','64']);if(s.wave===0)delete p.layers;}
   if(id===16){p.balance=range('Island balance');p.density=range('Contour spacing',40,160,8);}
   if(id===4)p.density=stops('Contour count',[44,64,88,112,136],['40','50','64','76','90']);
   if(id===14)p.density=stops('Meridian count',[44,64,88,112,136],['30','40','50','62','72']);
   if(id===18)p.layers=layers('Spiral pairs');
   if(id===19){delete p.winding;delete p.density;p.layers=layers('Contour count');p.spectral={label:'Mode family'};if([1,3].includes(v)){delete p.wave;p.balance=v===3?stops('Selected mode',[0,.3,.6,.9],['First','Second','Third','Fourth']):range('Mode mixture');}p.inkCycle=stops('Contrast motion',[0,1],['Fixed contrast','Slow harmonic cycle']);if(s.inkCycle===1)delete p.ink;}
   if(id===41){delete p.wave;delete p.layers;delete p.winding;p.balance=range('Circle-family balance');p.density=stops('Circles per family',[40,80,120,160],['6','8','10','12']);if(v===1){delete p.density;delete p.ink;}}
  }else{
   if([8,11].includes(id))p.density=stops('Tile density',[44,64,88,112,136],['Sparse','Open','Medium','Close','Fine']);
   if([32,33].includes(id))p.density=stops('Columns',[40,80,120,160],['16','20','24','28']);
   if(id===33)p.wave=range('Ribbon width');
   if(id===26)p.density=stops('Cell columns',[48,72,96,120,144],['16','24','32','40','48']);
   if(id===20)p.density=range('Filament fineness',40,160,8);
  }
  if(p.palette&&s.palette===3&&s.ink>0)delete p.ink;
  if(s.ink===0)delete p.palette;
  return p;
 }
 function closest(values,value){return values.reduce((best,v,i)=>Math.abs(v-value)<Math.abs(values[best]-value)?i:best,0);}
 const inactive={density:88,wave:.65,winding:2,layers:3,balance:.5,spectral:1,turns:1,recursion:3,palette:0,inkCycle:0};
 function normalise(id,v,state){
  // Resolve dependencies twice, e.g. a rounded generation count changing
  // which timing controls apply. Shared by the UI and saved presets.
  for(let pass=0;pass<2;pass++){
   const p=profile(id,v,state);
   for(const [key,value] of Object.entries(inactive))if(!p[key])state[key]=value;
   for(const [key,spec] of Object.entries(p)){
    if(spec.values)state[key]=spec.values[closest(spec.values,state[key])];
    else if(spec.min!==undefined)state[key]=Number((spec.min+Math.round((Math.max(spec.min,Math.min(spec.max,state[key]))-spec.min)/spec.step)*spec.step).toFixed(6));
   }
  }
  return state;
 }
 return {profile,closest,normalise};
})();
