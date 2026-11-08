const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const records=new Map();
function pop(section,delay=0){
  (records.get(section)||[]).forEach(a=>a.cancel());
  const object=section.querySelector('.object'),journal=section.dataset.item==='journal';
  if(reduced.matches){object.style.opacity=1;return;}
  const startAngle=journal?-3:4,settle=journal?-.35:.7;
  const motion=object.animate([
    {opacity:0,transform:`translate(-8px,-20px) scale(1.18) rotate(${startAngle}deg)`,filter:'drop-shadow(16px 26px 16px #24282024)',offset:0,easing:'cubic-bezier(.4,0,.75,.65)'},
    {opacity:1,transform:`translate(-4px,-10px) scale(1.10) rotate(${startAngle*.65}deg)`,filter:'drop-shadow(10px 17px 10px #24282030)',offset:.28,easing:'cubic-bezier(.2,.65,.3,1)'},
    {opacity:1,transform:`translate(0px,0px) scale(1) rotate(${settle}deg)`,filter:'drop-shadow(1px 2px 1px #07162bb3) drop-shadow(7px 10px 6px #07162b70)',offset:.74,easing:'ease-out'},
    {opacity:1,transform:`translate(${journal?0:3}px,0px) scale(1) rotate(${journal?.15:-.3}deg)`,filter:'drop-shadow(1px 2px 1px #07162bb3) drop-shadow(7px 10px 6px #07162b70)',offset:.88,easing:'ease-out'},
    {opacity:1,transform:'translate(0px,0px) scale(1) rotate(0deg)',filter:'drop-shadow(1px 2px 1px #07162bb3) drop-shadow(7px 10px 6px #07162b70)',offset:1}
  ],{duration:500,delay,fill:'both'});
  records.set(section,[motion]);
}
const sections=[...document.querySelectorAll('.desk-item')];
// Trigger from the mat's physical roll front, not independent time delays.
const waiting=new Set();let rolloutGeneration=0,settlementQueued=false;
function all(){
  rolloutGeneration++;settlementQueued=false;waiting.clear();
  sections.forEach(s=>{
    (records.get(s)||[]).forEach(a=>a.cancel());
    s.querySelector('.object').style.opacity=0;
    waiting.add(s);
  });
}
document.getElementById('stage').addEventListener('workstation-roll',all);
document.getElementById('stage').addEventListener('workstation-progress',event=>{
  for(const section of waiting){
    const right=Number(section.getAttribute('x'))+Number(section.getAttribute('width'));
    if(event.detail.front>=right+.35||event.detail.progress>=1){
      waiting.delete(section);pop(section);
      if(!waiting.size&&!settlementQueued){
        settlementQueued=true;const generation=rolloutGeneration;
        Promise.all(sections.flatMap(s=>(records.get(s)||[]).map(a=>a.finished.catch(()=>{})))).then(()=>{
          if(generation===rolloutGeneration)document.getElementById('stage').dispatchEvent(new Event('workstation-settled'));
        });
      }
    }
  }
});
reduced.addEventListener('change',()=>{sections.forEach(s=>pop(s));});

// Roll around each tool's long axis, independently of its entrance animation.
sections.filter(s=>['pencil','whitepen'].includes(s.dataset.item)).forEach(section=>{
  const object=section.querySelector('.object');
  const axis=object.querySelector('g[transform*="rotate("]');
  const surface=document.createElementNS('http://www.w3.org/2000/svg','g');
  surface.classList.add('roll-surface');
  while(axis.firstChild)surface.append(axis.firstChild);
  axis.append(surface);
  object.style.pointerEvents='visiblePainted';
  object.style.cursor='pointer';
  let rolling;
  function roll(){
    if(reduced.matches||document.getElementById('rollout').disabled||rolling)return;
    rolling=surface.animate([
      {transform:'translateY(0px) scaleY(1)',filter:'brightness(1)'},
      {transform:'translateY(-24px) scaleY(.83)',filter:'brightness(1.12)',offset:.22},
      {transform:'translateY(-50px) scaleY(1)',filter:'brightness(.94)',offset:.45},
      {transform:'translateY(-22px) scaleY(.88)',filter:'brightness(1.08)',offset:.68},
      {transform:'translateY(3px) scaleY(1)',filter:'brightness(1)',offset:.87},
      {transform:'translateY(0px) scaleY(1)',filter:'brightness(1)'}
    ],{duration:1100,easing:'ease-in-out'});
    rolling.onfinish=()=>{rolling=null;};
  }
  object.addEventListener('pointerenter',roll);
  object.addEventListener('pointerdown',event=>event.stopPropagation());
});

// Artwork is transparent ink on the sheets. Wide compositions share one
// coordinate system across the fold, then clip into each physical page.
{
  const journal=document.querySelector('[data-item="journal"]');
  const spread=journal.querySelector('.object > g[transform]');
  const ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs={})=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);return el;};
  // White hand-lettered strokes, kept crisp at every workstation scale.
  const flipNote=make('g',{'aria-label':'flip me :p',transform:'translate(3.7 -4.35) scale(.022)',fill:'none',stroke:'#fffdf2','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round'});
  flipNote.style.pointerEvents='none';flipNote.style.opacity=0;
  flipNote.style.transition='opacity .2s ease';
  flipNote.append(make('path',{transform:'translate(75 15)',d:'M6 29 Q7 5 14 3 Q20 2 18 7 M2 15 L17 14 M25 3 Q20 20 23 27 M33 15 L30 28 M34 7 L34.5 7 M42 15 L37 38 M41 20 Q50 10 52 18 Q53 27 40 28 M67 28 L70 16 L69 24 Q77 11 80 17 L78 27 Q89 10 90 19 L88 28 M97 24 Q111 20 106 16 Q98 13 95 24 Q95 32 109 27 M124 17 L124.5 17 M122 26 L122.5 26 M136 16 L130 38 M135 22 Q145 11 148 19 Q150 28 134 29'}));
  flipNote.append(make('path',{d:'M-18 63 L-11 73 L-2 65 M-11 73 Q-10 57 8 47 Q28 32 65 39','stroke-width':'1.5'}));
  document.getElementById('desk-objects').append(flipNote);
  // Split each pen stroke so the nib follows the revealed ink precisely.
  const strokes=[];
  for(const original of [...flipNote.children].reverse()){
    for(const d of original.getAttribute('d').match(/M[^M]+/g)||[]){
      const path=original.cloneNode();path.setAttribute('d',d);flipNote.append(path);
      const length=path.getTotalLength();path.style.strokeDasharray=String(length);path.style.strokeDashoffset=String(length);
      strokes.push({path,length,offset:original.hasAttribute('transform')?[75,15]:[0,0]});
    }
    original.remove();
  }
  const writer=document.querySelector('[data-item="whitepen"]');
  const home={x:Number(writer.getAttribute('x')),y:Number(writer.getAttribute('y'))};
  // Nib position after the pen's existing -98 degree rotation and SVG viewBox.
  const nib={x:2.4616,y:-.6406};
  let noteTimer,writingFrame=0,writing=false;
  function placePen(x,y){writer.setAttribute('x',x-nib.x);writer.setAttribute('y',y-nib.y);}
  function cancelWriting(){clearTimeout(noteTimer);cancelAnimationFrame(writingFrame);writing=false;writer.style.pointerEvents='';writer.setAttribute('x',home.x);writer.setAttribute('y',home.y);}
  const writingAxis=writer.querySelector('.object > g[transform]');
  const restAxis=writingAxis.getAttribute('transform');
  function posePen(x,y,angle,lift=0){
    const compression=1-lift*.22,rad=angle*Math.PI/180;
    writingAxis.setAttribute('transform',`translate(380 310) rotate(${angle}) scale(${compression} 1) translate(-380 -310)`);
    const tipX=(380+168*compression*Math.cos(rad)-140)/88;
    const tipY=(310+168*compression*Math.sin(rad)-200)/88;
    writer.setAttribute('x',x-tipX);writer.setAttribute('y',y-tipY);
    writingAxis.style.filter=`drop-shadow(${2+lift*9}px ${3+lift*12}px ${1+lift*5}px #07162b60)`;
  }
  const originalCancel=cancelWriting;
  cancelWriting=function(){originalCancel();writingAxis.setAttribute('transform',restAxis);writingAxis.style.filter='';};
  function writeNote(){
    flipNote.style.opacity=1;
    if(reduced.matches){strokes.forEach(s=>s.path.style.strokeDashoffset=0);return;}
    writing=true;writer.style.pointerEvents='none';
    writer.querySelectorAll('.roll-surface').forEach(s=>s.getAnimations().forEach(a=>a.cancel()));
    const world=(stroke,d)=>{const p=stroke.path.getPointAtLength(d);return{x:3.7+(p.x+stroke.offset[0])*.022,y:-4.35+(p.y+stroke.offset[1])*.022};};
    const rest={x:home.x+nib.x,y:home.y+nib.y},begin=world(strokes[0],0);
    const segments=[];let clock=500,previous=begin;
    strokes.forEach((stroke,i)=>{
      const first=world(stroke,0);
      if(i){segments.push({kind:'travel',start:clock,duration:110,from:previous,to:first});clock+=110;}
      const duration=Math.max(75,stroke.length*5);
      segments.push({kind:'ink',start:clock,duration,stroke});clock+=duration;
      previous=world(stroke,stroke.length);
    });
    const finish=clock,timeScale=3000/(clock+600),start=performance.now();let angle=-98,last=0;
    const ease=t=>t*t*(3-2*t),lerp=(a,b,t)=>a+(b-a)*t;
    function frame(now){
      const elapsed=(now-start)/timeScale,dt=Math.min(50,now-last||16);last=now;
      if(elapsed<500){
        const t=elapsed/500,e=ease(t),arc=Math.sin(Math.PI*t);
        posePen(lerp(rest.x,begin.x,e)+arc*.3,lerp(rest.y,begin.y,e)-arc*.65,lerp(-98,-225,e),arc*.8);angle=lerp(-98,-225,e);
      }else if(elapsed<finish){
        const segment=segments.find(s=>elapsed<s.start+s.duration);
        const t=Math.max(0,Math.min(1,(elapsed-segment.start)/segment.duration));
        if(segment.kind==='travel'){
          const e=ease(t),lift=Math.sin(Math.PI*t);
          angle+=(-225-angle)*(1-Math.exp(-dt/110));
          posePen(lerp(segment.from.x,segment.to.x,e),lerp(segment.from.y,segment.to.y,e)-lift*.12,angle,lift*.35);
        }else{
          const {stroke}=segment,d=stroke.length*t,p=world(stroke,d),next=world(stroke,Math.min(stroke.length,d+2));
          // A relaxed wrist follows the writing direction without spinning the barrel.
          const target=-225+Math.max(-9,Math.min(9,(next.x-p.x)*160+(next.y-p.y)*60));
          angle+=(target-angle)*(1-Math.exp(-dt/100));
          for(const earlier of strokes){if(earlier===stroke)break;earlier.path.style.strokeDashoffset=0;}
          stroke.path.style.strokeDashoffset=String(stroke.length-d);
          posePen(p.x,p.y,angle,.12+Math.sin(t*Math.PI)*.04);
        }
      }else{
        strokes.forEach(s=>s.path.style.strokeDashoffset=0);
        const t=Math.min(1,(elapsed-finish)/600),e=ease(t),arc=Math.sin(Math.PI*t);
        posePen(lerp(previous.x,rest.x,e)+arc*.25,lerp(previous.y,rest.y,e)-arc*.6,lerp(-225,-98,e),arc*.7);
        if(t>=1){cancelWriting();return;}
      }
      writingFrame=requestAnimationFrame(frame);
    }
    writingFrame=requestAnimationFrame(frame);
  }
  document.getElementById('stage').addEventListener('workstation-roll',()=>{cancelWriting();flipNote.style.opacity=0;strokes.forEach(s=>s.path.style.strokeDashoffset=String(s.length));});
  let writingScheduled=false;
  document.getElementById('stage').addEventListener('workstation-roll',()=>{writingScheduled=false;});
  document.getElementById('stage').addEventListener('workstation-progress',event=>{
    if(event.detail.progress>=1&&!writingScheduled){
      writingScheduled=true;
      noteTimer=setTimeout(writeNote,120);
    }
  });
  const pageRects=[...spread.querySelectorAll('rect')].filter(r=>r.getAttribute('fill')==='url(#jBlue)');
  const dots=spread.querySelector('path[fill="url(#jDots)"]');dots.style.opacity=0;
  const entries=[
    {paper:'url(#jBlue)',wide:'ink-03',white:true,dotted:true},
    {paper:'url(#jIvory)',pages:['ink-01','ink-02'],dotted:true},
    {paper:'#262626',wide:'ink-06',white:true,dotted:true},
    {paper:'url(#jBlue)',wide:'ink-04',white:true,dotted:true},
    {paper:'url(#jIvory)',wide:'ink-05'},
    {paper:'url(#jBlue)',pages:['ink-07','storyboard-ink'],white:true,dotted:true,lined:[true,false]},
    {paper:'url(#jBlue)',wide:'cowboys-01-ink',dotted:true},
    {paper:'#262626',wide:'cowboys-02-ink',dotted:true},
    {paper:'#262626',wide:'bird-ink',dotted:true},
    {paper:'#262626',pages:['heart-poem','living-working'],white:true,dotted:true,lined:[true,false]}
  ];
  const defs=make('defs');
  const ruling=make('pattern',{id:'journal-ruling',width:220,height:13,patternUnits:'userSpaceOnUse'});ruling.append(make('path',{d:'M0 12.5H220',stroke:'#f2f0e8','stroke-width':'.65',opacity:'.26'}));defs.append(ruling);
  [158,380].forEach((x,i)=>{const clip=make('clipPath',{id:`sheet-clip-${i}`,clipPathUnits:'userSpaceOnUse'});clip.append(make('rect',{x,y:167,width:i?216:219,height:286,rx:7}));defs.append(clip);});
  const white=make('filter',{id:'white-printed-ink',x:'-5%',y:'-5%',width:'110%',height:'110%'});white.append(make('feColorMatrix',{type:'matrix',values:'0 0 0 0 0.96 0 0 0 0 0.96 0 0 0 0 0.92 0 0 0 1 0'}));defs.append(white);
  spread.append(defs);
  const inkBounds={"storyboard-ink": {"size": [1536, 1024], "box": [433, 25, 1108, 973]}, "cowboys-01-ink": {"size": [1536, 1024], "box": [230, 59, 1214, 1001]}, "bird-ink": {"size": [1536, 1024], "box": [90, 56, 1455, 990]}, "cowboys-02-ink": {"size": [1774, 887], "box": [297, 17, 1501, 878]}, "ink-02": {"size": [1054, 1492], "box": [175, 464, 773, 1229]}, "ink-03": {"size": [1254, 1254], "box": [85, 122, 1184, 1197]}, "ink-01": {"size": [1148, 1370], "box": [42, 90, 1104, 1318]}, "ink-04": {"size": [1536, 1024], "box": [75, 53, 1468, 1010]}, "ink-05": {"size": [1774, 887], "box": [12, 218, 1740, 705]}, "ink-07": {"size": [1371, 1148], "box": [125, 22, 1254, 1125]}, "ink-06": {"size": [1269, 1240], "box": [69, 53, 1205, 1197]}, "living-working": {"size": [1359, 1157], "box": [112, 30, 1245, 1084]}, "heart-poem": {"size": [1774, 887], "box": [152, 95, 1676, 827]}};
  function art(index,side){
    const g=make('g',{'clip-path':`url(#sheet-clip-${side})`});g.style.pointerEvents='none';
    const entry=entries[index],name=entry.wide||entry.pages[side];
    if(entry.lined?.[side])g.append(make('rect',{x:side?390:168,y:180,width:196,height:260,fill:'url(#journal-ruling)'}));
    if(entry.dotted&&!entry.lined?.[side])g.append(make('rect',{x:side?380:158,y:167,width:219,height:286,fill:'url(#jDots)',opacity:'.35'}));
    if(name){
      // Fit the ink bounds rather than the source canvas: discard only empty
      // transparent margins, retaining every mark and the original proportions.
      const {size,box}=inkBounds[name];
      const pad=5,view=[box[0]-pad,box[1]-pad,box[2]-box[0]+pad*2,box[3]-box[1]+pad*2];
      const frame=make('svg',{x:entry.wide?166:(side?387:166),y:175,width:entry.wide?422:202,height:270,viewBox:view.join(' '),preserveAspectRatio:'xMidYMid meet',overflow:'hidden'});
      frame.append(make('image',{href:`./artwork/${name}.png`,x:0,y:0,width:size[0],height:size[1],...(entry.white?{filter:'url(#white-printed-ink)'}:{})}));
      g.append(frame);
    }
    return g;
  }
  const content=make('g');content.style.pointerEvents='none';
  // Keep the binding cord and gutter shading above the printed marks.
  spread.insertBefore(content,spread.querySelector('rect[fill="url(#jGutter)"]'));
  let page=0,busy=false,cornerTimer=0,cornerFrame=0,cornerDismissed=false;
  function hideCorner(){}
  function display(index){content.replaceChildren(art(index,0),art(index,1));pageRects.forEach(r=>r.setAttribute('fill',entries[index].paper));}
  display(0);
  function turn(direction){
    if(busy||document.getElementById('rollout').disabled)return;
    cornerDismissed=true;hideCorner();cancelWriting();flipNote.style.opacity=0;
    const next=(page+direction+entries.length)%entries.length;
    if(reduced.matches){page=next;display(page);return;}
    busy=true;
    const from=direction===1?1:0,to=1-from;
    const layer=make('g');layer.style.pointerEvents='none';
    const sheet=make('path',{stroke:'#594a3430','stroke-width':'.6'});
    sheet.style.filter='drop-shadow(4px 5px 4px #0004)';
    const moving=make('g');layer.append(sheet,moving);spread.append(layer);
    // New sheet revealed under the turning leaf.
    content.children[from].replaceWith(art(next,from));
    pageRects[from].setAttribute('fill',entries[next].paper);
    let reverse=false;
    moving.append(art(page,from));
    const start=performance.now();
    function frame(now){
      const t=Math.min(1,(now-start)/1000),e=t*t*(3-2*t),c=Math.cos(Math.PI*e);
      const reach=218*c*direction,lift=22*Math.sin(Math.PI*e),edge=378+reach;
      sheet.setAttribute('d',`M378 167 Q${378+reach*.55} ${167-lift} ${edge} ${167-lift*.3} Q${edge+Math.sign(reach)*lift*.3} 310 ${edge} ${453+lift*.3} Q${378+reach*.55} ${453+lift} 378 453Z`);
      sheet.setAttribute('fill',entries[e<.5?page:next].paper);
      if(e>=.5&&!reverse){moving.replaceChildren(art(next,to));reverse=true;}
      moving.setAttribute('transform',`translate(378 ${-lift*.2}) scale(${Math.max(.001,Math.abs(c))} 1) translate(-378 0)`);
      if(t<1)requestAnimationFrame(frame);
      else{layer.remove();page=next;display(page);busy=false;}
    }
    requestAnimationFrame(frame);
  }
  [-1,1].forEach((direction,i)=>{
    const hit=make('rect',{x:i?380:158,y:167,width:216,height:286,fill:'transparent',tabindex:0,role:'button','aria-label':i?'Flip page forward':'Flip page back'});
    hit.style.pointerEvents='all';hit.style.cursor='pointer';hit.style.outline='none';
    hit.addEventListener('pointerdown',e=>e.stopPropagation());
    hit.addEventListener('click',()=>turn(direction));
    hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();turn(direction);}});
    spread.append(hit);
  });
}
