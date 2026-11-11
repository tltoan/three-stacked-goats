const COLORS={ivory:'#eeeadd',blue:'#274abb',black:'#242424'};
const LABELS={black:'Black',brown:'Brown',olive:'Olive',sketch:'Sketch',lined:'Lined',dotted:'Dotted'};
const PAPER_LABELS={ivory:'Ivory',blue:'Cobalt',black:'Charcoal'};
const COPY={sketch:['For my artists.','blank pages for sketches, loose thoughts, and ideas that don’t fit on a line.'],lined:['For my writers.','lined pages for daily entries, your everyday notes, and the stories you’d want to tell.'],dotted:['For my polymaths.','dotted paper for when that one idea sticks and you want to feel special ;)']};
const fresh=()=>({leather:'brown',inserts:[{type:'sketch',color:'ivory'},{type:'lined',color:'ivory'},{type:'dotted',color:'ivory'}]});
const validState=(raw)=>{const s=fresh();if(['brown','black','olive'].includes(raw?.leather))s.leather=raw.leather;for(let i=0;i<3;i++){const b=raw?.inserts?.[i];if(['sketch','lined','dotted'].includes(b?.type))s.inserts[i].type=b.type;if(Object.hasOwn(COLORS,b?.color))s.inserts[i].color=b.color;}return s;};
let state=fresh(),activeBook=0,currentView='closed',viewer=null,toastTimer;
try{const saved=localStorage.getItem('3sg-concept');if(saved)state=validState(JSON.parse(saved));}catch{}
const params=new URLSearchParams(location.search);
if(['closed','open','exploded'].includes(params.get('view')))currentView=params.get('view');
if(params.has('cover')){const raw={leather:params.get('cover'),inserts:[1,2,3].map(n=>{const [type,color]=(params.get('b'+n)||'').split('.');return {type,color};})};state=validState(raw);}
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function configurationParams(){const p=new URLSearchParams({cover:state.leather,view:currentView});state.inserts.forEach((b,i)=>p.set('b'+(i+1),b.type+'.'+b.color));return p;}
function notify(message){const t=$('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3600);}
function drawPaper(){const b=state.inserts[activeBook],c=$('#paper-preview'),x=c.getContext('2d');x.fillStyle=COLORS[b.color];x.fillRect(0,0,400,500);let seed=12;for(let i=0;i<10000;i++){seed=(seed*16807)%2147483647;const px=seed%400;seed=(seed*16807)%2147483647;const py=seed%500;x.fillStyle=i%2?'rgba(0,0,0,.018)':'rgba(255,255,255,.028)';x.fillRect(px,py,1,1);}x.strokeStyle=b.color==='ivory'?'#919487':'#dddddd';x.fillStyle=x.strokeStyle;x.lineWidth=.7;if(b.type==='lined'){for(let y=56;y<465;y+=28){x.beginPath();x.moveTo(30,y);x.lineTo(370,y);x.stroke();}}else if(b.type==='dotted'){for(let y=42;y<470;y+=24)for(let xx=32;xx<375;xx+=24){x.beginPath();x.arc(xx,y,1.4,0,Math.PI*2);x.fill();}}c.setAttribute('aria-label',`Preview of ${PAPER_LABELS[b.color].toLowerCase()} ${b.type} paper`);}
function renderPaperDescription(type){
  const paragraph=$('#paper-description'),text=COPY[type][1],phrase='that one idea';
  paragraph.textContent=text;
  if(type==='dotted'&&text.includes(phrase)){
    const start=text.indexOf(phrase),emphasis=document.createElement('u');
    emphasis.textContent=phrase;
    paragraph.replaceChildren(text.slice(0,start),emphasis,text.slice(start+phrase.length));
  }
}
function render(){const b=state.inserts[activeBook];$$('[data-leather]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.leather===state.leather));$('#cover-name').textContent=LABELS[state.leather];$('#model-label').textContent=LABELS[state.leather]+' leather';$$('[data-book]').forEach((el,i)=>{el.setAttribute('aria-selected',i===activeBook);el.tabIndex=i===activeBook?0:-1;el.querySelector('small').textContent=LABELS[state.inserts[i].type];});$('#book-panel').setAttribute('aria-labelledby','book-tab-'+activeBook);$$('[data-format]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.format===b.type));$$('[data-paper]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.paper===b.color));$('#paper-color-name').textContent=PAPER_LABELS[b.color];$('#paper-title').textContent=COPY[b.type][0];renderPaperDescription(b.type);$('#combination-cover').textContent=LABELS[state.leather]+' leather cover';$('#combination-books').replaceChildren(...state.inserts.map((book,i)=>{const li=document.createElement('li'),swatch=document.createElement('span'),text=document.createElement('span'),number=document.createElement('span');swatch.className='mini-sheet';swatch.style.background=COLORS[book.color];text.textContent=LABELS[book.type]+' · '+PAPER_LABELS[book.color];number.textContent='Book '+(i+1);li.append(swatch,text,number);return li;}));drawPaper();viewer?.setState({...state,activeInsert:activeBook});try{localStorage.setItem('3sg-concept',JSON.stringify(state));}catch{}}
function changeView(view){currentView=view;viewer?.setView(view);$$('[data-view]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.view===view));}
$$('[data-leather]').forEach(el=>el.addEventListener('click',()=>{state.leather=el.dataset.leather;render();}));
$$('[data-book]').forEach(el=>{el.addEventListener('click',()=>{activeBook=Number(el.dataset.book);render();if(viewer)changeView('open');});el.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();activeBook=e.key==='Home'?0:e.key==='End'?2:(activeBook+(e.key==='ArrowRight'?1:2))%3;render();$('#book-tab-'+activeBook).focus();if(viewer)changeView('open');});});
$$('[data-format]').forEach(el=>el.addEventListener('click',()=>{state.inserts[activeBook].type=el.dataset.format;render();if(viewer)changeView('open');}));
$$('[data-paper]').forEach(el=>el.addEventListener('click',()=>{state.inserts[activeBook].color=el.dataset.paper;render();if(viewer)changeView('open');}));
$$('[data-view]').forEach(el=>el.addEventListener('click',()=>changeView(el.dataset.view)));
$('#reset-view').addEventListener('click',()=>{viewer?.reset();changeView('closed');notify('View reset. Your paper choices are kept.');});
$('#save-config')?.addEventListener('click',()=>{const text=['THREE STACKED GOATS','Your journal concept','',`Leather cover: ${LABELS[state.leather]}`,...state.inserts.map((b,i)=>`Book ${i+1}: ${LABELS[b.type]} / ${PAPER_LABELS[b.color]} paper`),'','Closed size: 5 in tall x 4 in wide (127 x 101.6 mm).','Capacity: three replaceable books.','Status: product concept, not an order.','Model proportions, material finish, paper weights, page counts, ruling/dots, attachment and writing compatibility require physical samples.','',`Reopen this combination: ${new URL('./',location.href).href}?${configurationParams()}`].join('\n');const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='three-stacked-goats-combination.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Your combination has been downloaded.');});
render();
const container=$('#journal-viewer');
function failModel(){
  container.classList.remove('model-ready');
  container.classList.add('model-failed');
  container.removeAttribute('data-ready');
  container.setAttribute('aria-busy','false');
  container.setAttribute('aria-label','3D journal preview unavailable.');
  container.tabIndex=-1;
  $('#model-loading').textContent='The 3D preview couldn’t load. Reload to try again.';
  $('#model-hint').textContent='Preview unavailable';
  $$('[data-view]').forEach(b=>b.disabled=true);
  $('#reset-view').disabled=true;
  viewer?.dispose();
  viewer=null;
}
container.addEventListener('journal-ready',()=>{
  if(container.classList.contains('model-failed'))return;
  container.classList.add('model-ready');
  container.setAttribute('data-ready','true');
  container.setAttribute('aria-busy','false');
});
container.addEventListener('journal-error',failModel);
import('./journal3d.js?v=28').then(({createJournalViewer})=>{viewer=createJournalViewer(container,{...state,activeInsert:activeBook});changeView(currentView);}).catch(e=>{console.error('Journal preview unavailable:',e);failModel();});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');observer.unobserve(e.target);}}),{threshold:.15});$$('.origin-intro h2,.origin-intro p,.reference-gallery figure,.paper-story h2,.paper-story-list>div,.faq h2,.faq details').forEach(e=>observer.observe(e));
window.addEventListener('pagehide',event=>{if(!event.persisted)viewer?.dispose();});

const modelStage=$('#model-stage');
container.addEventListener('journal-detail',event=>modelStage.classList.toggle('show-magnify',event.detail.visible));
$('#close-journal-detail').addEventListener('click',()=>{viewer?.dismissDetail();$('#reset-view').focus({preventScroll:true});});
