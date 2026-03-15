(function(){'use strict';
const typeColors={'Field Report':'#4fd8ff','Roadtrip Guide':'#ff5733','Event Preview':'#e8ff47'};
let lastRenderedSlug='';

function injectSlot(){
  if(document.getElementById('dt-drawer-article'))return;
  const desc=document.getElementById('dt-drawer-description');
  if(!desc)return;
  const a=document.createElement('a');
  a.id='dt-drawer-article';
  a.href='#';
  a.style.cssText='display:none;background:#161616;border-radius:8px;padding:14px 16px;margin-bottom:5px;align-items:flex-start;gap:10px;color:#fff;text-decoration:none;box-shadow:inset 3px 0 0 #4fd8ff';
  a.addEventListener('click',function(e){e.stopPropagation()});
  a.innerHTML='<svg style="width:20px;height:20px;flex-shrink:0;margin-top:1px;opacity:.6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><div style="flex:1;display:flex;flex-direction:column;gap:4px"><span id="dt-drawer-article-type" style="font-size:.7rem;font-weight:400;opacity:.5;text-transform:uppercase;letter-spacing:.09em;margin:3px 0"></span><span id="dt-drawer-article-intro" style="font-size:1rem;font-weight:300;line-height:1.5"></span><span style="font-size:.8rem;font-weight:300;opacity:.6;margin-top:6px;margin-bottom:6px">Read article ›</span></div>';
  desc.insertAdjacentElement('afterend',a);
}

function updateBlock(eventSlug,type,intro,articleSlug){
  const block=document.getElementById('dt-drawer-article');
  if(!block)return;
  if(lastRenderedSlug===eventSlug)return;
  lastRenderedSlug=eventSlug;
  if(!articleSlug){block.style.display='none';return;}
  const color=typeColors[type]||'#4fd8ff';
  block.style.boxShadow='inset 3px 0 0 '+color;
  block.href='/articles/'+articleSlug;
  const typeEl=document.getElementById('dt-drawer-article-type');
  const introEl=document.getElementById('dt-drawer-article-intro');
  if(typeEl)typeEl.textContent=type||'';
  if(introEl)introEl.textContent=intro||'';
  block.style.display='flex';
}

function onDrawerOpen(){
  const p=new URLSearchParams(window.location.search);
  const slug=p.get('event');
  if(!slug)return;
  const li=document.querySelector(`.cru-ncf-map-list-item[data-slug="${slug}"]`);
  const articleSlug=li?li.dataset.articleSlug:'';
  const type=li?li.dataset.eventArticleType:'';
  const intro=li?li.dataset.articleIntro:'';
  updateBlock(slug,type,intro,articleSlug);
}

function onDrawerClose(){
  lastRenderedSlug='';
  const block=document.getElementById('dt-drawer-article');
  if(block)block.style.display='none';
}

function init(){
  injectSlot();
  const drawer=document.getElementById('dt-drawer');
  if(!drawer)return;
  let wasActive=false;
  new MutationObserver(function(){
    const isActive=drawer.classList.contains('is-active');
    if(isActive&&!wasActive){wasActive=true;onDrawerOpen();}
    else if(!isActive&&wasActive){wasActive=false;onDrawerClose();}
  }).observe(drawer,{attributes:true,attributeFilter:['class']});
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}
})();
