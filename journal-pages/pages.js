// Photographic layers and a 2D canvas page curl. No WebGL scene or orbit camera.
const canvas = document.getElementById('journal');
const ctx = canvas.getContext('2d');
const book = document.getElementById('book');
const W = 1586, H = 992, HALF = W / 2;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const experience = document.querySelector('[data-journal-pages]');
const controls = [...experience.querySelectorAll('.arrow,.page-hit')];
const replayButton = document.getElementById('replay');
const title = document.getElementById('spread-title');
const counter = document.getElementById('counter');
const announcement = document.getElementById('announcement');
const hint = document.getElementById('hint');
const clamp = t => Math.max(0,Math.min(1,t));
const smooth = t => {t=clamp(t);return t*t*(3-2*t);};
const ease = t => {t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const artRoot = new URL('../workstation/artwork/',import.meta.url);
const spreads = [
  {title:'Action cues fear.',paper:'blue',ruling:'dotted',wide:'ink-03',box:[85,122,1099,1075],scale:.93},
  {title:'A place to begin.',paper:'black',ruling:'lined',pages:[['ink-01',[42,90,1062,1228]],['ink-02',[175,464,598,765]]]},
  {title:'Stories taking shape.',paper:'ivory',ruling:'unruled',wide:'ink-06',box:[69,53,1136,1144],scale:.94},
  {title:'Out on the range.',paper:'blue',ruling:'unruled',wide:'cowboys-01-ink',box:[230,59,984,942],scale:.98},
  {title:'A little further west.',paper:'black',ruling:'unruled',wide:'cowboys-02-ink',box:[297,17,1204,861],scale:.98},
  {title:'Let the mind wander.',paper:'black',ruling:'unruled',wide:'bird-ink',box:[90,56,1365,934],scale:.98},
  {title:'Something worth keeping.',paper:'blue',ruling:'lined',wide:'ink-04',box:[75,53,1393,957],scale:.95},
];
const paperTints = {blue:'#345fc8',black:'#2b3038'};
let openImage,coverImage,textures=[],leafTextures=[],page=0,busy=true,frame=0,generation=0,landingAnimation;
let queuedDirection=0,intro=false,dragStart=null,suppressClick=false,entranceStarted=false;

function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Could not load ${src}`));image.src=src;});}
function makeCanvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
function fittedArt(target,image,box,rect){
  const [sx,sy,sw,sh]=box,[x,y,w,h]=rect,ratio=Math.min(w/sw,h/sh),dw=sw*ratio,dh=sh*ratio;
  target.drawImage(image,sx,sy,sw,sh,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
function paperOutline(target,side){
  // Trace only the photographed paper; the leather stays stationary during a turn.
  target.beginPath();
  if(side===0){
    target.moveTo(790,47);target.bezierCurveTo(550,39,240,28,102,35);
    target.quadraticCurveTo(62,37,62,83);target.lineTo(64,892);
    target.quadraticCurveTo(64,948,112,952);target.bezierCurveTo(340,957,630,949,790,946);
  }else{
    target.moveTo(801,45);target.bezierCurveTo(1020,36,1320,29,1468,35);
    target.quadraticCurveTo(1508,37,1513,79);target.lineTo(1510,892);
    target.quadraticCurveTo(1508,944,1465,951);target.bezierCurveTo(1260,959,980,951,801,947);
  }
  target.closePath();
}
function drawPaper(target,entry){
  for(let side=0;side<2;side++){
    target.save();paperOutline(target,side);
    if(paperTints[entry.paper]){
      // Dye the photographed paper, retaining its grain, edge layers and gutter shadows.
      target.globalCompositeOperation='multiply';target.fillStyle=paperTints[entry.paper];
      target.strokeStyle=paperTints[entry.paper];target.lineWidth=6;
      target.fill();target.stroke();target.globalCompositeOperation='source-over';
    }
    target.clip();
    const left=side===0?96:834,right=side===0?758:1478;
    if(entry.ruling==='dotted'){
      target.fillStyle='rgba(223,233,255,.26)';target.beginPath();
      for(let y=81;y<925;y+=25)for(let x=left;x<right;x+=25){
        target.moveTo(x+1.25,y);target.arc(x,y,1.25,0,Math.PI*2);
      }
      target.fill();
    }else if(entry.ruling==='lined'){
      target.strokeStyle='rgba(223,233,255,.17)';target.lineWidth=1.1;target.beginPath();
      for(let y=109;y<925;y+=37){target.moveTo(left,y);target.lineTo(right,y);}
      target.stroke();
    }
    target.restore();
  }
}
function composeSpread(entry,images){
  const c=makeCanvas(),p=c.getContext('2d');p.drawImage(openImage,0,0,W,H);
  drawPaper(p,entry);
  const ink=makeCanvas(),a=ink.getContext('2d');
  if(entry.wide){
    const scale=entry.scale||1;fittedArt(a,images[entry.wide],entry.box,[126+(1-scale)*650,91+(1-scale)*400,1330*scale,810*scale]);
  }else entry.pages.forEach(([name,box],side)=>fittedArt(a,images[name],box,[side?850:126,96,610,803]));
  if(entry.paper!=='ivory'){
    // The source alpha is the drawn ink. White-on-dark art must not be multiplied away.
    a.globalCompositeOperation='source-in';a.fillStyle='#fffdf3';a.fillRect(0,0,W,H);
  }
  for(let side=0;side<2;side++){
    p.save();paperOutline(p,side);p.clip();
    p.globalCompositeOperation=entry.paper==='ivory'?'multiply':'source-over';
    p.drawImage(ink,0,0);p.restore();
  }
  // Restore only the brown binding cord; the surrounding gutter keeps the paper's dye.
  p.drawImage(openImage,788,0,13,H,788,0,13,H);
  const leaves=[0,1].map(side=>{const leaf=makeCanvas(),l=leaf.getContext('2d');paperOutline(l,side);l.clip();l.drawImage(c,0,0);return leaf;});
  return {spread:c,leaves};
}
function drawStill(index=page){ctx.clearRect(0,0,W,H);ctx.drawImage(textures[index],0,0);book.dataset.page=String(index+1);}
function lock(value){busy=value;controls.forEach(b=>b.disabled=value);if(replayButton)replayButton.disabled=value;book.setAttribute('aria-busy',String(value));}
function updateCaption(){
  title.textContent=spreads[page].title;counter.textContent=`${page+1} / ${spreads.length}`;
  counter.setAttribute('aria-label',`Spread ${page+1} of ${spreads.length}`);
  canvas.setAttribute('aria-label',`${spreads[page].title} ${spreads[page].paper} ${spreads[page].ruling} paper. Illustrated journal spread ${page+1} of ${spreads.length}.`);
  announcement.textContent=`${spreads[page].title} Spread ${page+1} of ${spreads.length}.`;
}

function paintCurledLeaf({progress,direction,front,back}){
  const angle=Math.PI*progress, bend=.30*Math.sin(angle),count=88;
  const strip=HALF/count,points=[{x:0,z:0,angle}],focal=15000;
  let x=0,z=0;
  for(let i=0;i<count;i++){
    const u=(i+.5)/count,local=angle-bend*Math.sin(Math.PI*u);
    x+=strip*Math.cos(local);z+=strip*Math.sin(local);
    points.push({x:direction*x,z,angle:local});
  }
  // Outer strips are drawn last while facing the viewer; reverse when seen from the back.
  const order=Array.from({length:count},(_,i)=>i);
  if(progress>.5)order.reverse();
  for(const i of order){
    const a=points[i],b=points[i+1];
    const frontVisible=Math.cos((a.angle+b.angle)/2)>=0;
    const source=frontVisible?front:back;
    const sourceSide=frontVisible?(direction===1?1:0):(direction===1?0:1);
    const sourceX=sourceSide===1?HALF+i*strip:HALF-(i+1)*strip;
    const fa=focal/(focal-a.z),fb=focal/(focal-b.z);
    const xa=HALF+a.x*fa,xb=HALF+b.x*fb,dx=xb-xa;
    if(Math.abs(dx)<.01)continue;
    const scale=(fa+fb)/2;
    // The sampled photograph carries the paper's contour, grain, and artwork.
    const normalDirection=sourceSide===1?1:-1;
    const sourceStart=normalDirection===1?xa:xb;
    const signedWidth=normalDirection===1?dx:-dx;
    const tilt=-Math.sin(angle)*5*(i/count);
    ctx.save();
    ctx.translate(sourceStart,H/2-H*scale/2+tilt);
    ctx.scale(Math.sign(signedWidth),1);
    ctx.drawImage(source,sourceX,0,strip,H,0,0,Math.abs(signedWidth)+.7,H*scale);
    ctx.restore();
  }
  // Broad, restrained shading follows the curved leaf rather than a hard rectangular panel.
  {
    const end=points.at(-1),edge=HALF+end.x*focal/(focal-end.z),left=Math.min(HALF,edge),width=Math.abs(edge-HALF);
    if(width>2){
      ctx.save();ctx.globalCompositeOperation='source-atop';
      const shade=ctx.createLinearGradient(HALF,0,edge,0);
      shade.addColorStop(0,`rgba(43,32,21,${.13*Math.sin(angle)})`);
      shade.addColorStop(.5,`rgba(255,255,246,${.08*Math.sin(angle)})`);
      shade.addColorStop(1,'rgba(43,32,21,0)');ctx.fillStyle=shade;
      ctx.fillRect(left,25,width,H-50);ctx.restore();
    }
  }
}

function drawTurn(from,to,progress,direction){
  ctx.clearRect(0,0,W,H);
  // The fixed leather outline and page block remain beneath the turning paper.
  ctx.drawImage(textures[from],0,0);
  const incomingSide=direction===1?1:0;
  ctx.drawImage(textures[to],incomingSide*HALF,0,HALF,H,incomingSide*HALF,0,HALF,H);
  const shade=Math.sin(Math.PI*progress);
  ctx.save();paperOutline(ctx,incomingSide);ctx.clip();
  const gradient=ctx.createLinearGradient(HALF,0,HALF+direction*HALF,0);
  gradient.addColorStop(0,`rgba(43,33,22,${shade*.22})`);gradient.addColorStop(.66,'rgba(43,33,22,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);ctx.restore();
  paintCurledLeaf({progress,direction,front:leafTextures[from][incomingSide],back:leafTextures[to][1-incomingSide]});
}
function turn(direction){
  if(busy){if(!intro)queuedDirection=direction;return;}
  const next=(page+direction+spreads.length)%spreads.length;
  if(reduced.matches){page=next;drawStill();updateCaption();return;}
  lock(true);book.dataset.state='turning';const token=++generation,start=performance.now();
  function tick(now){
    if(token!==generation)return;
    const p=clamp((now-start)/1050);drawTurn(page,next,ease(p),direction);
    if(p<1)frame=requestAnimationFrame(tick);
    else{page=next;drawStill();updateCaption();book.dataset.state='open';lock(false);hint.textContent='Swipe, click, or use the arrow keys.';if(queuedDirection){const queued=queuedDirection;queuedDirection=0;turn(queued);}}
  }
  frame=requestAnimationFrame(tick);
}

const coverSurface=makeCanvas(),coverCtx=coverSurface.getContext('2d');
const coverWidth=745,coverScale=coverWidth/960;
let openingBack;
function coverCurve(progress){
  const angle=Math.PI*progress,lift=Math.sin(angle),flex=.36*lift;
  const start=-80*coverScale,end=(coverImage.width-80)*coverScale,count=120;
  const distances=[...Array.from({length:count+1},(_,i)=>start+(end-start)*i/count),0,coverWidth].sort((a,b)=>a-b);
  let x=start*Math.cos(angle),z=start*Math.sin(angle);
  const points=[{distance:start,x:HALF+x,z,scale:1}];
  for(let i=1;i<distances.length;i++){
    const distance=distances[i],previous=distances[i-1],u=clamp((distance+previous)/2/coverWidth);
    // The outer leather trails the spine in a broad curve, then relaxes completely flat.
    const local=angle-flex*smooth(u),length=distance-previous;
    x+=length*Math.cos(local);z+=length*Math.sin(local);
    const scale=30000/(30000-z),sag=7*lift*clamp(distance/coverWidth)**2;
    points.push({distance,x:HALF+x*scale,z,scale,sag,normal:Math.cos(local)});
  }
  return {points,lift};
}
function paintSoftCover(progress,curve){
  coverCtx.clearRect(0,0,W,H);
  if(progress===0){
    // Preserve the exact closed-cover silhouette shared by landing and opening.
    coverCtx.drawImage(coverImage,HALF-80*coverScale,2,coverImage.width*coverScale,H-4);
  }else if(progress===1){
    coverCtx.drawImage(openingBack,0,0);
  }else{
    const {points,lift}=curve;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],front=b.normal>=0,dx=b.x-a.x;
      if(Math.abs(dx)<.015)continue;
      const length=b.distance-a.distance;
      const source=front?coverImage:openingBack;
      const sx=front?80+a.distance/coverScale:HALF-b.distance;
      const sw=front?length/coverScale:length;
      const first=front?a:b,last=front?b:a,signedWidth=front?dx:-dx;
      const scale=(a.scale+b.scale)/2,height=(front?H-4:H)*scale;
      const top=H/2-height/2+(first.sag||0),tilt=((last.sag||0)-(first.sag||0))/Math.abs(dx);
      coverCtx.save();coverCtx.translate(first.x,top);
      coverCtx.transform(Math.sign(signedWidth),tilt,0,1,0,0);
      // Sample the overlap at the same scale so adjacent strips don't repeat the grain.
      const width=Math.abs(dx),bleed=Math.min(1.5,width*.75);
      coverCtx.drawImage(source,sx,0,sw*(1+bleed/width),source.height,0,0,width+bleed,height);
      coverCtx.restore();
    }
    // Light follows the bent surface, clipped to its photographed silhouette.
    const xs=points.map(p=>p.x),left=Math.min(...xs),right=Math.max(...xs);
    if(right-left>1){
      coverCtx.save();coverCtx.globalCompositeOperation='source-atop';
      const sheen=coverCtx.createLinearGradient(left,0,right,0);
      sheen.addColorStop(0,`rgba(31,20,14,${lift*.08})`);
      sheen.addColorStop(.48,`rgba(255,236,212,${lift*.075})`);
      sheen.addColorStop(1,`rgba(31,20,14,${lift*.12})`);
      coverCtx.fillStyle=sheen;coverCtx.fillRect(0,0,W,H);coverCtx.restore();
    }
  }
  ctx.drawImage(coverSurface,0,0);
}
function drawOpening(progress){
  const curve=coverCurve(progress),{lift}=curve;
  ctx.clearRect(0,0,W,H);ctx.save();
  // Keep the closed book still until the cover lifts, then make room for its left half.
  ctx.translate(-coverWidth/2*(1-smooth((progress-.36)/.64)),0);
  if(progress>0){
    // Reveal paper only beyond the moving cover edge, never as a slit at the spine.
    const outerEdge=Math.max(...curve.points.filter(p=>p.distance>=0&&p.distance<=coverWidth).map(p=>p.x));
    const edge=Math.max(HALF,outerEdge-8*lift);
    ctx.save();ctx.beginPath();ctx.rect(edge,0,W-edge,H);ctx.clip();
    ctx.globalAlpha=smooth(progress/.055);
    ctx.drawImage(textures[0],HALF,0,HALF,H,HALF,0,HALF,H);
    ctx.globalAlpha=1;paperOutline(ctx,1);ctx.clip();
    const shade=ctx.createLinearGradient(HALF,0,W,0);
    shade.addColorStop(0,`rgba(25,19,14,${lift*.28})`);shade.addColorStop(1,'rgba(25,19,14,0)');
    ctx.fillStyle=shade;ctx.fillRect(HALF,0,HALF,H);ctx.restore();
  }
  paintSoftCover(progress,curve);
  ctx.restore();
}
function finishOpening(){
  intro=false;landingAnimation?.cancel();book.style.transform='';book.style.opacity='';
  page=0;drawStill();updateCaption();book.dataset.state='open';lock(false);
}
async function replayOpening(){
  const token=++generation;cancelAnimationFrame(frame);queuedDirection=0;intro=true;lock(true);
  page=0;updateCaption();book.dataset.state='landing';hint.textContent='Click a page, or use the arrow keys.';
  if(reduced.matches){finishOpening();return;}
  // The landing and opening share their first frame, including the cover's exact bounds.
  drawOpening(0);
  landingAnimation?.cancel();
  landingAnimation=book.animate([
    {transform:'translateY(-42px) scale(1.045) rotate(-2deg)',opacity:0,offset:0},
    {transform:'translateY(-27px) scale(1.025) rotate(-1.1deg)',opacity:1,offset:.28},
    {transform:'translateY(2px) scale(.998) rotate(.12deg)',opacity:1,offset:.78},
    {transform:'translateY(0) scale(1) rotate(0deg)',opacity:1,offset:1}
  ],{duration:850,easing:'cubic-bezier(.32,.05,.36,1)',fill:'forwards'});
  try{await landingAnimation.finished;}catch{return;}
  if(token!==generation)return;
  book.dataset.state='opening';const start=performance.now();
  function tick(now){
    if(token!==generation)return;
    const p=clamp((now-start-160)/1450);drawOpening(ease(p));
    if(p<1)frame=requestAnimationFrame(tick);else finishOpening();
  }
  frame=requestAnimationFrame(tick);
}
function requestTurn(direction){if(suppressClick){suppressClick=false;return;}turn(direction);}
document.querySelector('.previous').addEventListener('click',()=>turn(-1));
document.querySelector('.next').addEventListener('click',()=>turn(1));
document.querySelector('.page-hit.left').addEventListener('click',()=>requestTurn(-1));
document.querySelector('.page-hit.right').addEventListener('click',()=>requestTurn(1));
replayButton?.addEventListener('click',replayOpening);
const keyboardTarget=experience.hasAttribute('data-homepage')?experience:document;
keyboardTarget.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();turn(event.key==='ArrowRight'?1:-1);
});
book.addEventListener('pointerdown',event=>{if(event.isPrimary&&!busy){suppressClick=false;dragStart={x:event.clientX,y:event.clientY};}});
book.addEventListener('pointerup',event=>{
  if(!dragStart)return;const dx=event.clientX-dragStart.x,dy=event.clientY-dragStart.y;dragStart=null;
  if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.3){suppressClick=true;turn(dx<0?1:-1);}
});
book.addEventListener('pointercancel',()=>{dragStart=null;});
reduced.addEventListener('change',()=>{if(entranceStarted&&reduced.matches&&textures.length){generation++;cancelAnimationFrame(frame);landingAnimation?.cancel();queuedDirection=0;intro=false;drawStill();updateCaption();book.dataset.state='open';lock(false);}});
document.addEventListener('visibilitychange',()=>{if(entranceStarted&&document.hidden&&textures.length&&busy){generation++;cancelAnimationFrame(frame);landingAnimation?.cancel();queuedDirection=0;if(intro)finishOpening();else{drawStill();book.dataset.state='open';lock(false);}}});

// Only the explicit standalone Replay button may restart an entrance already shown.
export function startJournal(){
  if(entranceStarted||!textures.length)return;
  entranceStarted=true;
  replayOpening();
}

try{
  const names=[...new Set(spreads.flatMap(s=>s.wide?[s.wide]:s.pages.map(p=>p[0])))];
  const loaded=await Promise.all([
    loadImage(new URL('./assets/open-journal.png',import.meta.url).href),
    loadImage(new URL('./assets/closed-journal.png',import.meta.url).href),
    ...names.map(name=>loadImage(new URL(`${name}.png`,artRoot).href))
  ]);
  [openImage,coverImage]=loaded;const images=Object.fromEntries(names.map((name,i)=>[name,loaded[i+2]]));
  for(const entry of spreads){const composed=composeSpread(entry,images);textures.push(composed.spread);leafTextures.push(composed.leaves);}
  openingBack=makeCanvas();openingBack.getContext('2d').drawImage(textures[0],0,0,HALF,H,0,0,HALF,H);
  document.getElementById('loading').hidden=true;
  // Keep the canvas blank until the real entrance; the logo's page reveal happens first.
  if(experience.hasAttribute('data-defer-opening'))book.dataset.state='ready';
  else startJournal();
}catch(error){
  const message=document.getElementById('loading');message.textContent='The journal could not load. Reload to try again.';
  book.dataset.state='error';book.setAttribute('aria-busy','false');console.error(error);
}
