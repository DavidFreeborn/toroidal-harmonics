(() => {
 const groups=[...document.querySelectorAll('.study-group')],search=document.getElementById('study-search'),status=document.getElementById('search-result');
 function reveal(){
  const id=location.hash.slice(1),target=/^study-\d+$/.test(id)?document.getElementById(id):null;
  if(!target)return;
  target.closest('details').open=true;target.scrollIntoView({block:'start'});target.focus({preventScroll:true});
 }
 search.addEventListener('input',()=>{
  const query=search.value.trim().toLocaleLowerCase();let count=0;
  for(const group of groups){let matches=0;for(const article of group.querySelectorAll('article')){
   const found=!query||article.textContent.toLocaleLowerCase().includes(query);article.hidden=!found;if(found){matches++;count++;}
  }group.hidden=matches===0;if(query)group.open=matches>0;}
  status.hidden=!query;status.textContent=count+' matching '+(count===1?'study':'studies');
 });
 addEventListener('hashchange',reveal);reveal();
})();
