(function(){'use strict';
const styleEl=document.createElement('style');
styleEl.textContent=`.dt-article-badge{position:absolute;left:-1px;padding:5px 9px;border-radius:4px;font-size:12px;font-weight:400;line-height:1;white-space:nowrap;z-index:9;text-decoration:none;pointer-events:auto;display:inline-block}.dt-article-badge:hover{opacity:.85}`;
document.head.appendChild(styleEl);

const typeStyles={
  'Field Report':   {bg:'#4fd8ff80', color:'#fff'},
  'Roadtrip Guide': {bg:'#ff573380', color:'#fff'},
  'Event Preview':  {bg:'#e8ff4780', color:'#fff'}
};
            
function positionBadges(item){
  const article=item.querySelector('.dt-article-badge');
  if(!article)return;
  const time=item.querySelector('.dt-upcoming-badge');
  article.style.top=time?'-58px':'-30px';
}

function injectArticleBadges(){
  document.querySelectorAll('.cru-ncf-map-list-item').forEach(item=>{
    const slug=item.dataset.articleSlug;
    const type=item.dataset.eventArticleType;
    if(!slug||!type)return;
    if(!item.querySelector('.dt-article-badge')){
      const s=typeStyles[type]||{bg:'#4fd8ff80',color:'#fff'};
      const b=document.createElement('a');
      b.className='dt-article-badge';
      b.href=`/articles/${slug}`;
      b.textContent=type;
      b.style.background=s.bg;
      b.style.color=s.color;
      item.appendChild(b);
    }
    positionBadges(item);
  });
}

function init(){
  setTimeout(injectArticleBadges,300);
  setTimeout(injectArticleBadges,800);
  setTimeout(injectArticleBadges,1500);
  const lc=document.querySelector('.horizontal-scroll,.cru-ncf-map-list');
  if(lc){new MutationObserver(()=>setTimeout(injectArticleBadges,100)).observe(lc,{childList:true,subtree:true})}
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}
})();
