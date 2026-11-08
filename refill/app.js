import {PAPER_TYPES,PACK_PRICE,STORAGE_KEY,freshPack,validPack,setPaper,packText} from './config-state.mjs';

const scope=document.getElementById('refills');
const $=selector=>scope.querySelector(selector),$$=selector=>[...scope.querySelectorAll(selector)];
let state=freshPack(),activeBook=0,lastAction='initial',storageAvailable=true;
try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)state=validPack(JSON.parse(saved));}catch{storageAvailable=false;}
const listeners=new Set();
const snapshot=()=>({books:[...state.books],activeBook,lastAction});
function emit(reason){lastAction=reason;for(const listener of listeners)listener({...snapshot(),reason});}
function announce(text){$('#refill-selection-status').textContent=text;}
function drawPaper(type){
  const canvas=$('#refill-paper-preview'),ctx=canvas.getContext('2d');
  ctx.fillStyle='#eeeadd';ctx.fillRect(0,0,400,500);
  let seed=61;for(let i=0;i<11000;i++){
    seed=seed*16807%2147483647;const x=seed%400;seed=seed*16807%2147483647;const y=seed%500;
    ctx.fillStyle=i%2?'rgba(61,55,37,.035)':'rgba(255,255,255,.14)';ctx.fillRect(x,y,1,1);
  }
  ctx.strokeStyle='#a1a28e';ctx.fillStyle='#969884';ctx.lineWidth=.85;
  if(type==='lined')for(let y=54;y<462;y+=27){ctx.beginPath();ctx.moveTo(29,y);ctx.lineTo(371,y);ctx.stroke();}
  if(type==='dotted')for(let y=39;y<471;y+=23)for(let x=29;x<378;x+=23){ctx.beginPath();ctx.arc(x,y,1.25,0,Math.PI*2);ctx.fill();}
  canvas.setAttribute('aria-label',`${PAPER_TYPES[type].label} ivory paper preview for Book ${activeBook+1}`);
}
function render(){
  const type=state.books[activeBook];
  $$('[data-refill-book]').forEach(el=>{
    const i=Number(el.dataset.refillBook);el.setAttribute('aria-selected',String(i===activeBook));el.tabIndex=i===activeBook?0:-1;
    el.querySelector('small').textContent=PAPER_TYPES[state.books[i]].label;
  });
  $$('[data-refill-model-book]').forEach(el=>{
    const i=Number(el.dataset.refillModelBook);el.setAttribute('aria-pressed',String(i===activeBook));
    el.querySelector('strong').textContent=PAPER_TYPES[state.books[i]].label;
    el.setAttribute('aria-label',`Book ${i+1}, ${PAPER_TYPES[state.books[i]].label} pages. Customize this booklet.`);
  });
  $('#refill-panel').setAttribute('aria-labelledby',`refill-tab-${activeBook}`);
  $$('[data-refill-format]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.refillFormat===type)));
  $('#refill-paper-title').textContent={blank:'For my artists.',lined:'For my writers.',dotted:'For my polymaths.'}[type];
  $('#refill-paper-description').textContent=PAPER_TYPES[type].description;
  drawPaper(type);
  $('#refill-summary').replaceChildren(...state.books.map((type,i)=>{
    const li=document.createElement('li'),sheet=document.createElement('span'),copy=document.createElement('span'),number=document.createElement('span');
    sheet.className='mini-sheet';sheet.style.background='#eeeadd';sheet.setAttribute('aria-hidden','true');
    copy.textContent=`${PAPER_TYPES[type].label} · Ivory`;number.textContent=`Book ${i+1}`;
    li.append(sheet,copy,number);return li;
  }));
  $$('[data-refill-price]').forEach(el=>el.textContent=`$${PACK_PRICE}`);
  $('#refill-save-note').textContent=storageAvailable?'Your choices stay saved on this device.':'Your choices are kept while this page is open.';
}
function select(index,focus=false){
  if(!Number.isInteger(index)||index<0||index>2)return;
  activeBook=index;render();emit('select');
  announce(`Book ${index+1} selected. ${PAPER_TYPES[state.books[index]].label} pages.`);
  if(focus)$(`#refill-tab-${index}`).focus({preventScroll:true});
}
function selectFromModel(index){
  select(index,true);
  if(matchMedia('(max-width:700px)').matches)$('#refill-build').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
$$('[data-refill-book]').forEach(el=>{
  el.addEventListener('click',()=>select(Number(el.dataset.refillBook)));
  el.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
    select(event.key==='Home'?0:event.key==='End'?2:(activeBook+(event.key==='ArrowRight'?1:2))%3,true);
  });
});
$$('[data-refill-model-book]').forEach(el=>el.addEventListener('click',()=>selectFromModel(Number(el.dataset.refillModelBook))));
$$('[data-refill-format]').forEach(el=>el.addEventListener('click',()=>{
  state=setPaper(state,activeBook,el.dataset.refillFormat);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageAvailable=true;}catch{storageAvailable=false;}
  render();emit('paper');announce(`Book ${activeBook+1} changed to ${PAPER_TYPES[state.books[activeBook]].label}.`);
}));
$('#save-refill').addEventListener('click',()=>{
  const blob=new Blob([packText(state)],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='three-stacked-goats-refill-pack.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  announce('Your refill pack selection has been downloaded.');$('#refill-save-note').textContent='Your combination has been downloaded.';
});
render();
const configurator={getState:snapshot,selectFromModel,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}};
// Keep the third WebGL scene dormant until the refill product is close to view.
const observer=new IntersectionObserver(entries=>{
  if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();
  import('./viewer.js?v=3').then(({createRefillViewer})=>createRefillViewer(scope,configurator)).then(()=>{
    $$('[data-refill-view],#refill-reset').forEach(el=>el.disabled=false);
  }).catch(error=>{
    console.error('Refill preview unavailable:',error);
    $('#refill-loading').hidden=false;$('#refill-loading').textContent='The 3D preview couldn’t load. You can still choose your pages below.';
    $('#refill-viewer').setAttribute('aria-busy','false');$('#refill-viewer').tabIndex=-1;
  });
},{rootMargin:'600px'});
observer.observe($('#refill-model-stage'));
