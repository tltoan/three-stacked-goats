import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UNPACK_SECONDS, ramp, unpackMotion, bookletLayout } from './motion.mjs?v=4';
import { loadCordMotion } from './cord-motion.js?v=2';


export async function createRefillViewer(scope,configurator){
const stage=scope.querySelector('#refill-viewer');
const loading=scope.querySelector('#refill-loading');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const compactLayout=matchMedia('(max-width:700px)');
// Model units are inches. Height and width are the user's 5 × 4 specification;
// thickness is a slim visual estimate until the paper stock is confirmed.
const W=4,L=5,H=.075,COVER=.0035,FOLD=.017,CORNER=.13;
const PAGE_LAYERS=16,PAGE_STEP=(H-COVER*2-.004)/PAGE_LAYERS;
const TIE_RADIUS=.027;
const BASE=TIE_RADIUS*2+.004,GAP=.005;
const resources={geometries:new Set(),materials:new Set(),textures:new Set()};
const keep=(type,value)=>(resources[type].add(value),value);
const random=(seed=932)=>()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};

try{
  await Promise.all([document.fonts.load('12px "Geist Mono"'),document.fonts.load('20px "Geist Serif"')]);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  stage.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(31,1,.05,80);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.09;
  controls.enablePan=false;controls.rotateSpeed=.65;
  controls.minPolarAngle=.025;controls.maxPolarAngle=Math.PI*.49;
  controls.minDistance=6;controls.maxDistance=26;
  const root=new THREE.Group();scene.add(root);
  const hemi=new THREE.HemisphereLight('#ffffff','#b1a28e',1.65);scene.add(hemi);
  const key=new THREE.DirectionalLight('#fff9ef',2.6);key.position.set(-5,12,7);
  key.castShadow=true;key.shadow.mapSize.set(4096,4096);
  Object.assign(key.shadow.camera,{left:-17,right:17,top:20,bottom:-20,near:.1,far:45});
  key.shadow.bias=-.0002;key.shadow.normalBias=.006;key.shadow.radius=4;scene.add(key);
  const fill=new THREE.DirectionalLight('#e6ecf4',.75);fill.position.set(4,4,-5);scene.add(fill);

  function canvasTexture(canvas,color=true){
    const texture=keep('textures',new THREE.CanvasTexture(canvas));
    texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  function kraftTexture(index){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1280;
    const ctx=canvas.getContext('2d'),rnd=random(401+index*91);
    const pixels=ctx.createImageData(canvas.width,canvas.height);
    for(let i=0;i<pixels.data.length;i+=4){
      const n=(rnd()-.5)*20;
      pixels.data[i]=141+n;pixels.data[i+1]=112+n;pixels.data[i+2]=84+n;pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    for(let i=0;i<220;i++){
      const x=rnd()*canvas.width,y=rnd()*canvas.height,r=15+rnd()*80;
      const cloud=ctx.createRadialGradient(x,y,0,x,y,r);
      cloud.addColorStop(0,i%2?'rgba(75,52,28,.012)':'rgba(255,242,213,.015)');cloud.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=cloud;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    for(let i=0;i<16000;i++){
      const x=rnd()*canvas.width,y=rnd()*canvas.height;
      ctx.strokeStyle=i%3?'rgba(65,47,24,.05)':'rgba(255,248,225,.12)';ctx.lineWidth=.5+rnd()*.8;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rnd()-.5)*2,y+1+rnd()*5);ctx.stroke();
    }
    // Plain, fibrous kraft covers, matching the refill insert reference.
    return canvasTexture(canvas);
  }
  const paperTextures=new Map();
  function paperTexture(type){
    if(paperTextures.has(type))return paperTextures.get(type);
    const c=document.createElement('canvas');c.width=512;c.height=640;
    const x=c.getContext('2d'),data=x.createImageData(c.width,c.height),rnd=random(61);
    for(let i=0;i<data.data.length;i+=4){const n=(rnd()-.5)*8;data.data[i]=238+n;data.data[i+1]=234+n;data.data[i+2]=221+n;data.data[i+3]=255;}
    x.putImageData(data,0,0);
    x.strokeStyle='#8b8e82';x.fillStyle='#797d70';x.lineWidth=2.2;
    if(type==='lined')for(let y=55;y<600;y+=34){x.beginPath();x.moveTo(30,y);x.lineTo(482,y);x.stroke();}
    if(type==='dotted')for(let y=45;y<605;y+=29)for(let px=32;px<485;px+=29){x.beginPath();x.arc(px,y,3.2,0,Math.PI*2);x.fill();}
    const texture=canvasTexture(c);paperTextures.set(type,texture);return texture;
  }
  function paperBend(x,z){
    const edge=Math.pow(THREE.MathUtils.clamp((x+W/2)/W,0,1),1.8);
    const end=z/(L/2),tension=1-.8*Math.exp(-(((z-.30)/.35)**2));
    return edge*(.006+.018*Math.abs(end)**3+.003*Math.sin(z*1.9))*tension;
  }
  function coverCurl(x,z){
    const edge=Math.pow(THREE.MathUtils.clamp((x+W/2)/W,0,1),2.2);
    const end=z/(L/2),tension=1-.9*Math.exp(-(((z-.30)/.35)**2));
    return edge*(.010+.032*Math.max(0,end)**5+.016*Math.max(0,-end)**6)*tension;
  }
  function sheet(width,length,thickness,radius,flexibleCover=false){
    // Subdivided paper faces bend together; there is no rigid beveled board.
    const nx=flexibleCover?40:18,nz=flexibleCover?64:36,row=nx+1;
    const p=[],uv=[],indices=[],foldRadius=.012;
    const inset=(r,d)=>d<r?r-Math.sqrt(Math.max(0,r*r-(r-d)**2)):0;
    for(const side of [1,-1])for(let j=0;j<=nz;j++){
      // Put extra rows around the small corner arcs instead of faceting them.
      const edgeRows=8;
      const z=j<edgeRows?-length/2+radius*j/edgeRows:j>nz-edgeRows?length/2-radius*(nz-j)/edgeRows:-length/2+radius+(j-edgeRows)/(nz-edgeRows*2)*(length-radius*2);
      const d=length/2-Math.abs(z);
      const left=-width/2+inset(foldRadius,d),right=width/2-inset(radius,d);
      for(let i=0;i<=nx;i++){
        const x=THREE.MathUtils.lerp(left,right,i/nx);
        p.push(x,paperBend(x+FOLD/2,z)+side*thickness/2,z);uv.push(x/width+.5,.5-z/length);
      }
    }
    const faceCount=row*(nz+1);
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const a=j*row+i,b=a+1,c=a+row,d=c+1;
      indices.push(a,c,b,b,c,d,a+faceCount,b+faceCount,c+faceCount,b+faceCount,d+faceCount,c+faceCount);
    }
    const edge=[];
    for(let i=0;i<=nx;i++)edge.push(i);
    for(let j=1;j<=nz;j++)edge.push(j*row+nx);
    for(let i=nx-1;i>=0;i--)edge.push(nz*row+i);
    for(let j=nz-1;j>0;j--)edge.push(j*row);
    for(let i=0;i<edge.length;i++){
      const a=edge[i],b=edge[(i+1)%edge.length],start=p.length/3;
      for(const v of [a,a+faceCount,b,b+faceCount]){p.push(p[v*3],p[v*3+1],p[v*3+2]);uv.push(uv[v*2],uv[v*2+1]);}
      indices.push(start,start+2,start+1,start+2,start+3,start+1);
    }
    const g=keep('geometries',new THREE.BufferGeometry());
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    if(flexibleCover){
      const curled=p.slice();
      for(let i=0;i<curled.length;i+=3)curled[i+1]+=coverCurl(curled[i]+FOLD/2,curled[i+2]);
      g.morphAttributes.position=[new THREE.Float32BufferAttribute(curled,3)];
      const bent=g.clone();bent.morphAttributes={};bent.setAttribute('position',new THREE.Float32BufferAttribute(curled,3));bent.computeVertexNormals();
      g.morphAttributes.normal=[bent.attributes.normal.clone()];bent.dispose();
    }
    return g;
  }
  function mesh(geometry,material,parent){
    const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const coverGeometry=sheet(W-FOLD,L,COVER,CORNER,true);
  const pageGeometry=sheet(W-FOLD-.03,L-.03,PAGE_STEP*.96,CORNER-.015);
  function makeSpine(material,parent){
    const p=[],uv=[],indices=[],rows=36;
    // The folded kraft wraps continuously around the left edge of each book.
    for(let j=0;j<=rows;j++){
      const angle=Math.PI*j/rows,y=H/2+Math.cos(angle)*(H/2-COVER/2);
      const x=-W/2+FOLD-Math.sin(angle)*FOLD;
      for(const z of [-L/2+.014,L/2-.014]){p.push(x,y,z);uv.push(j/rows,(z+L/2)/L);}
      if(j<rows){const a=j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const g=keep('geometries',new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const spineMaterial=keep('materials',material.clone());spineMaterial.side=THREE.DoubleSide;
    mesh(g,spineMaterial,parent);
  }
  const books=[];
  for(let i=0;i<3;i++){
    const book=new THREE.Group();root.add(book);
    const slot=[1,0,2][i];
    const kraftMap=kraftTexture(i);
    const cover=keep('materials',new THREE.MeshStandardMaterial({map:kraftMap,bumpMap:kraftMap,bumpScale:.003,roughness:.96,metalness:0}));
    const pageMaterial=keep('materials',new THREE.MeshStandardMaterial({map:paperTexture(configurator.getState().books[slot]),roughness:1}));
    mesh(coverGeometry,cover,book).position.set(FOLD/2,COVER/2,0);
    // A common fold line keeps every leaf attached to its saddle-stitched spine.
    const foldX=-W/2+FOLD,foldY=H/2;
    const hinge=()=>{const pivot=new THREE.Group();pivot.position.set(foldX,foldY,0);book.add(pivot);return pivot;};
    const coverPivot=hinge();
    const topCover=mesh(coverGeometry,cover,coverPivot);topCover.position.set(FOLD/2-foldX,H-COVER/2-foldY,0);
    topCover.morphTargetInfluences[0]=i===2?1:0;
    const turningPages=[],rnd=random(322+i);
    for(let j=0;j<PAGE_LAYERS;j++){
      const moving=j>=PAGE_LAYERS/2,pivot=moving?hinge():book;
      const page=mesh(pageGeometry,pageMaterial,pivot);
      page.position.set(FOLD/2+(rnd()-.5)*.0015-(moving?foldX:0),COVER+.002+(j+.5)*PAGE_STEP-(moving?foldY:0),(rnd()-.5)*.002);
      page.rotation.y=(rnd()-.5)*.0015;
      if(moving)turningPages.push({pivot,lag:(PAGE_LAYERS-1-j)/(PAGE_LAYERS/2-1)});
    }
    makeSpine(cover,book);
    const stack=new THREE.Vector3([-.014,.006,0][i],BASE+i*(H+GAP),[.012,-.008,0][i]);
    book.userData.bookSlot=slot;
    books.push({book,topCover,coverPivot,turningPages,pageMaterial,stack,slot,selectionLift:0,rotation:[-.007,.009,-.003][i]});
    book.position.copy(stack);book.rotation.y=books[i].rotation;
  }
  function updatePaperChoices(state){
    for(const item of books){
      const type=state.books[item.slot];
      if(item.paperType===type)continue;
      item.paperType=type;item.pageMaterial.map=paperTexture(type);item.pageMaterial.needsUpdate=true;
    }
    stage.setAttribute('aria-label','Interactive 3D refill pack. '+state.books.map((type,i)=>`Book ${i+1}: ${type} ivory pages`).join('. ')+'. Choose a book to untie the pack and open all three. Drag or use arrow keys to rotate.');
  }
  updatePaperChoices(configurator.getState());

  const cordGroup=new THREE.Group();root.add(cordGroup);
  function feltTexture(){
    const c=document.createElement('canvas');c.width=c.height=256;
    const ctx=c.getContext('2d'),rnd=random(823),pixels=ctx.createImageData(256,256);
    for(let i=0;i<pixels.data.length;i+=4){const n=105+rnd()*45;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=n;pixels.data[i+3]=255;}
    ctx.putImageData(pixels,0,0);
    for(let i=0;i<1300;i++){
      const x=rnd()*256,y=rnd()*256;
      ctx.strokeStyle=i%2?'rgba(240,240,240,.20)':'rgba(45,45,45,.16)';ctx.lineWidth=.5+rnd();
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+5,y+(rnd()-.5)*5,x+9+rnd()*10,y+(rnd()-.5)*4);ctx.stroke();
    }
    const t=canvasTexture(c,false);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(18,2);return t;
  }
  const feltMap=feltTexture();
  const feltMaterial=color=>keep('materials',new THREE.MeshPhysicalMaterial({color,roughness:1,metalness:0,bumpMap:feltMap,bumpScale:.006,sheen:.65,sheenColor:'#5b5d61',sheenRoughness:1}));
  const twineBase=feltMaterial('#262729');
  const twineStrands=['#303134','#212225','#353638'].map(feltMaterial);
  const fiberMaterial=keep('materials',new THREE.LineBasicMaterial({color:'#535457',transparent:true,opacity:.66}));
  const top=BASE+2*(H+GAP)+H+TIE_RADIUS-.004;
  function twine(points,{closed=false,radius=TIE_RADIUS,seed=71,frayed=false}={}){
    const curve=typeof points.getPoint==='function'?points:new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
    const parts=[];
    const addPart=(geometry,material)=>{
      const object=mesh(geometry,material,cordGroup);
      parts.push({object,geometry,parameters:Float32Array.from(geometry.attributes.uv.array.filter((_,i)=>i%2===0))});
      return object;
    };
    const length=curve.getLength(),segments=Math.max(100,Math.ceil(length*100));
    const core=keep('geometries',new THREE.TubeGeometry(curve,segments,radius*.90,10,closed));
    addPart(core,twineBase);
    const frames=curve.computeFrenetFrames(segments,closed),strandRadius=radius*.28,twists=length/.19;
    for(let strand=0;strand<3;strand++){
      const vertices=[];
      for(let j=0;j<=segments;j++){
        const t=j/segments,angle=t*twists*Math.PI*2+strand*Math.PI*2/3;
        const p=curve.getPointAt(t).addScaledVector(frames.normals[j],Math.cos(angle)*radius*.70).addScaledVector(frames.binormals[j],Math.sin(angle)*radius*.70);
        vertices.push(p);
      }
      const strandCurve=new THREE.CatmullRomCurve3(vertices,false,'centripetal');
      addPart(keep('geometries',new THREE.TubeGeometry(strandCurve,segments,strandRadius,5,false)),twineStrands[strand]);
    }
    const rnd=random(seed),hairs=[],hairParameters=[];
    for(let i=0;i<Math.ceil(length*220);i++){
      const t=rnd(),j=Math.min(segments,Math.round(t*segments)),a=rnd()*Math.PI*2;
      const p=curve.getPointAt(t),out=frames.normals[j].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[j],Math.sin(a));
      const drift=(rnd()-.5)*.08;
      const start=p.clone().addScaledVector(out,radius*.86);
      const middle=p.clone().addScaledVector(out,radius*(1.08+rnd()*.35)).addScaledVector(frames.tangents[j],drift*.5);
      const end=p.clone().addScaledVector(out,radius*(.95+rnd()*.7)).addScaledVector(frames.tangents[j],drift);
      hairs.push(...start.toArray(),...middle.toArray(),...middle.toArray(),...end.toArray());
      hairParameters.push(t,t,t,t);
    }
    if(frayed)for(const tip of [0,1]){
      const j=tip*segments,end=curve.getPointAt(tip),normal=frames.normals[j],binormal=frames.binormals[j],tangent=frames.tangents[j].clone().multiplyScalar(tip?1:-1);
      for(let i=0;i<26;i++){
        const angle=rnd()*Math.PI*2,out=normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal,Math.sin(angle));
        const start=end.clone().addScaledVector(out,radius*rnd()*.65);
        const strandTip=end.clone().addScaledVector(tangent,.018+rnd()*.075).addScaledVector(out,radius*(.5+rnd()*1.5));
        hairs.push(...start.toArray(),...strandTip.toArray());
        hairParameters.push(tip,tip);
      }
    }
    const hairGeometry=keep('geometries',new THREE.BufferGeometry());hairGeometry.setAttribute('position',new THREE.Float32BufferAttribute(hairs,3));
    const hairObject=new THREE.LineSegments(hairGeometry,fiberMaterial);cordGroup.add(hairObject);
    parts.push({object:hairObject,geometry:hairGeometry,parameters:Float32Array.from(hairParameters)});
    return{curve,parts};
  }
  // One continuous, fixed-length strand. The bake first feeds the slipping
  // bight into its tail, then uses a constrained rope pulled only at its ends.
  const cordMotion=await loadCordMotion();
  const cord=twine(cordMotion.curve,{seed:300,frayed:true});
  cordMotion.bind(cord.parts);

  const floorMaterial=keep('materials',new THREE.ShadowMaterial({opacity:.14}));
  const floor=mesh(keep('geometries',new THREE.PlaneGeometry(200,200)),floorMaterial,scene);
  floor.rotation.x=-Math.PI/2;floor.position.y=-.004;floor.castShadow=false;
  function contactShadow(){
    const c=document.createElement('canvas');c.width=c.height=256;
    const ctx=c.getContext('2d'),g=ctx.createRadialGradient(128,128,28,128,128,126);
    g.addColorStop(0,'rgba(41,31,19,.24)');g.addColorStop(.65,'rgba(41,31,19,.10)');g.addColorStop(1,'rgba(41,31,19,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);
    const m=keep('materials',new THREE.MeshBasicMaterial({map:canvasTexture(c),transparent:true,depthWrite:false}));
    const shadow=new THREE.Mesh(keep('geometries',new THREE.PlaneGeometry(W+1.15,L+1.1)),m);shadow.rotation.x=-Math.PI/2;shadow.position.y=.002;scene.add(shadow);return shadow;
  }
  const contactShadows=books.map(()=>contactShadow());

  // One ground outline follows the selected physical booklet. The text labels
  // are real buttons, giving the 3D picks an equivalent keyboard/touch control.
  const outlineShape=new THREE.Shape(),ow=W+.11,ol=L/2+.11,r=.15;
  outlineShape.moveTo(-ow+r,-ol);outlineShape.lineTo(ow-r,-ol);outlineShape.quadraticCurveTo(ow,-ol,ow,-ol+r);
  outlineShape.lineTo(ow,ol-r);outlineShape.quadraticCurveTo(ow,ol,ow-r,ol);outlineShape.lineTo(-ow+r,ol);
  outlineShape.quadraticCurveTo(-ow,ol,-ow,ol-r);outlineShape.lineTo(-ow,-ol+r);outlineShape.quadraticCurveTo(-ow,-ol,-ow+r,-ol);
  const outlinePoints=outlineShape.getPoints(10).map(p=>new THREE.Vector3(p.x,.008,p.y));
  const selectionOutline=new THREE.LineLoop(keep('geometries',new THREE.BufferGeometry().setFromPoints(outlinePoints)),keep('materials',new THREE.LineBasicMaterial({color:'#6b7357'})));
  scene.add(selectionOutline);selectionOutline.visible=false;
  const labels=scope.querySelector('#refill-labels'),labelButtons=[...labels.querySelectorAll('button')],labelPosition=new THREE.Vector3();
  let selectedBook=configurator.getState().activeBook;

  let view='pack',unpack=0,goalUnpack=0,cameraMoving=false,autoFrame=true,disposed=false,active=true;
  let lastPhase='',lastBusy=false,inView=true;
  const goalPosition=new THREE.Vector3(),goalTarget=new THREE.Vector3(0,.21,0);
  const homeDirection=new THREE.Vector3(4.8,6.4,7.8).normalize();
  const readingDirection=new THREE.Vector3(.06,1,.27).normalize();
  function frame(immediate=false){
    const aspect=Math.max(.1,stage.clientWidth/stage.clientHeight);
    const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const motion=unpackMotion(unpack),layout=motion.camera,portrait=compactLayout.matches;
    const halfWidth=THREE.MathUtils.lerp(W/2+.18,portrait?W+2.7:W+8.65+.3,layout);
    const minZ=THREE.MathUtils.lerp(-L/2-.22,-5.25,ramp(unpack,.2,.53))-1.5*Math.sin(Math.PI*ramp(unpack,.24,.6));
    const maxZ=THREE.MathUtils.lerp(L/2+.22,portrait?11.8+L/2+.85:L/2+.85,layout);
    // While opening, a leaf reaches four inches above the spine. Include that
    // arc in the fit so the cover never clips through the edge of the viewport.
    const leafHeight=Math.max(...motion.openProgress.map(p=>W*Math.sin(Math.PI*p)));
    const modelHeight=Math.max(THREE.MathUtils.lerp(top+.22,H+.25,layout),leafHeight+.2);
    const finalMinZ=portrait?-L/2-.4:minZ;
    const fitMinZ=THREE.MathUtils.lerp(minZ,finalMinZ,motion.pageCamera);
    goalTarget.set(0,modelHeight/2,(fitMinZ+maxZ)/2);
    const direction=homeDirection.clone().lerp(readingDirection,motion.pageCamera).normalize();
    const right=new THREE.Vector3(direction.z,0,-direction.x).normalize();
    const up=new THREE.Vector3().crossVectors(direction,right).normalize();
    let fit=0;
    for(const x of [-halfWidth,halfWidth])for(const y of [0,modelHeight])for(const z of [fitMinZ,maxZ]){
      const corner=new THREE.Vector3(x,y,z).sub(goalTarget),depth=corner.dot(direction);
      fit=Math.max(fit,Math.abs(corner.dot(right))/(tangent*aspect)+depth,Math.abs(corner.dot(up))/tangent+depth);
    }
    const distance=fit*THREE.MathUtils.lerp(1.32,1.07,motion.pageCamera);
    controls.maxDistance=Math.max(17,distance*1.5);
    goalPosition.copy(direction).multiplyScalar(distance).add(goalTarget);
    cameraMoving=true;
    if(immediate){camera.position.copy(goalPosition);controls.target.copy(goalTarget);camera.lookAt(controls.target);controls.update();cameraMoving=false;}
  }
  function setView(next){
    if(!['pack','booklets'].includes(next))return;
    view=next;goalUnpack=next==='booklets'?1:0;
    scope.dataset.refillLayout=view;
    autoFrame=true;lastPhase='';
    if(reducedMotion.matches)unpack=goalUnpack;
    scope.querySelectorAll('[data-refill-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.refillView===view)));
    frame(reducedMotion.matches);
  }
  const unsubscribeConfig=configurator.subscribe(state=>{
    const {activeBook,reason}=state;selectedBook=activeBook;updatePaperChoices(state);
    if(reason==='review')setView('pack');
    else if(view!=='booklets'||goalUnpack!==1)setView('booklets');
  });
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let pointerStart=null,hoveredBook=null,pointerDirty=false,pointerInside=false;
  function updatePointer(event){
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);pointerDirty=true;pointerInside=true;
  }
  function pickBook(){
    if(unpack<.999||goalUnpack!==1)return null;
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(books.map(({book})=>book),true)[0];
    if(!hit)return null;let object=hit.object;
    while(object&&object.userData.bookSlot===undefined)object=object.parent;
    return object?.userData.bookSlot??null;
  }
  renderer.domElement.addEventListener('pointermove',updatePointer);
  renderer.domElement.addEventListener('pointerleave',()=>{pointerInside=false;hoveredBook=null;stage.style.cursor='grab';});
  renderer.domElement.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};updatePointer(event);});
  renderer.domElement.addEventListener('pointerup',event=>{
    if(pointerStart&&Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)<7){updatePointer(event);const slot=pickBook();if(slot!==null)configurator.selectFromModel(slot);}
    pointerStart=null;
  });
  renderer.domElement.addEventListener('pointercancel',()=>pointerStart=null);
  scope.querySelectorAll('[data-refill-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.refillView)));
  scope.querySelector('#refill-reset').addEventListener('click',()=>setView('pack'));
  controls.addEventListener('start',()=>{cameraMoving=false;autoFrame=false;});
  stage.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();cameraMoving=false;autoFrame=false;
    const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(event.key==='ArrowLeft')s.theta-=.12;if(event.key==='ArrowRight')s.theta+=.12;
    if(event.key==='ArrowUp')s.phi=Math.max(.025,s.phi-.12);if(event.key==='ArrowDown')s.phi=Math.min(Math.PI*.49,s.phi+.12);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();
  });
  function resize(){
    controls.enableZoom=false;
    renderer.domElement.style.touchAction=compactLayout.matches?'pan-y pinch-zoom':'none';
    renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();frame(true);lastPhase='';
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
  const visibility=()=>active=inView&&!document.hidden;document.addEventListener('visibilitychange',visibility);
  const viewportObserver=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;visibility();},{rootMargin:'100px'});viewportObserver.observe(scope);
  let previous=0;
  renderer.setAnimationLoop(time=>{
    if(disposed||!active)return;
    const delta=Math.min((time-previous)/1000||.016,.06);previous=time;
    const ease=reducedMotion.matches?1:1-Math.exp(-delta*7);
    const previousUnpack=unpack;
    const step=reducedMotion.matches?1:delta/UNPACK_SECONDS;
    unpack+=Math.sign(goalUnpack-unpack)*Math.min(Math.abs(goalUnpack-unpack),step);
    const motion=unpackMotion(unpack),busy=unpack!==goalUnpack;
    if(previousUnpack!==unpack&&autoFrame)frame();
    if(lastBusy!==busy){stage.setAttribute('aria-busy',String(busy));lastBusy=busy;}
    if(lastPhase!==motion.phase){
      stage.dataset.phase=motion.phase;lastPhase=motion.phase;
      const copy=goalUnpack===1?{'loosening':'Loosening the tie…','unwrapping':'Pulling the tie free…','setting-tie-down':'Setting the tie aside…','laying-out':'Laying out the booklets…','opening':'Opening your pages…'}:{'loosening':'Finishing the knot…','unwrapping':'Wrapping the stack…','setting-tie-down':'Picking up the tie…','laying-out':'Stacking the booklets…','opening':'Closing the booklets…'};
      scope.querySelector('#refill-view-status').textContent=copy[motion.phase]||(motion.phase==='open'?'Select a book to choose its pages':compactLayout.matches?'Drag sideways to rotate':'Drag to explore');
    }
    const canSelect=unpack===1&&goalUnpack===1;
    labels.hidden=!canSelect;selectionOutline.visible=canSelect;
    books.forEach((item,i)=>{
      const {book,topCover,coverPivot,turningPages,stack,rotation,slot}=item;
      const progress=motion.bookProgress[i],opening=motion.openProgress[i];
      const layout=bookletLayout(slot,compactLayout.matches);
      const position=new THREE.Vector3(layout.x,.006,layout.z);
      book.position.lerpVectors(stack,position,progress);
      book.position.y-=(BASE-.006)*motion.settle*(1-progress);
      book.position.y+=Math.sin(progress*Math.PI)*.42+.05*opening;
      item.selectionLift=THREE.MathUtils.lerp(item.selectionLift,canSelect&&slot===selectedBook ? .10 : 0,ease);
      book.position.y+=item.selectionLift;
      book.rotation.y=THREE.MathUtils.lerp(rotation,[-.012,0,.012][slot],progress);
      book.rotation.z=Math.sin(progress*Math.PI)*(i===2?-.045:.04);
      coverPivot.rotation.z=Math.PI*ramp(opening,0,.82);
      for(const {pivot,lag} of turningPages)pivot.rotation.z=Math.PI*ramp(opening,.04+lag*.1,.86+lag*.14);
      topCover.morphTargetInfluences[0]=(i===2?1:motion.settle)*(1-opening);
      contactShadows[i].position.x=book.position.x-W/2*opening;
      contactShadows[i].position.z=book.position.z;contactShadows[i].scale.x=1+opening*.8;
      contactShadows[i].material.opacity=i===0?1:progress*.7;
      if(canSelect&&slot===selectedBook){
        book.updateMatrixWorld(true);
        selectionOutline.position.copy(book.localToWorld(new THREE.Vector3(-W/2+FOLD,-book.position.y+.008,0)));
        selectionOutline.rotation.y=book.rotation.y;
      }
    });
    cordMotion.update(motion.cordTime);
    if(cameraMoving){camera.position.lerp(goalPosition,ease);controls.target.lerp(goalTarget,ease);if(camera.position.distanceTo(goalPosition)<.001)cameraMoving=false;}
    controls.update();
    if(pointerInside&&(pointerDirty||cameraMoving)){
      hoveredBook=pickBook();stage.style.cursor=hoveredBook===null?'grab':'pointer';pointerDirty=false;
    }
    if(canSelect){
      // Project from the booklet's front edge into the viewer's CSS coordinates.
      const width=stage.clientWidth,height=stage.clientHeight;
      for(const {book,slot} of books){
        labelPosition.set(compactLayout.matches?W/2+1.35:-W/2+FOLD,0,compactLayout.matches?0:L/2+.43).applyMatrix4(book.matrixWorld).project(camera);
        const x=(labelPosition.x*.5+.5)*width+stage.offsetLeft,y=(-labelPosition.y*.5+.5)*height+stage.offsetTop;
        labelButtons[slot].style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
        labelButtons[slot].hidden=labelPosition.z>1||x<10||x>width-10;
      }
    }
    renderer.render(scene,camera);
  });
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();loading.hidden=false;loading.textContent='Preview paused. Reload to restore the 3D pack.';});
  if(['select','paper'].includes(configurator.getState().lastAction))setView('booklets');
  stage.setAttribute('aria-busy','false');stage.dataset.ready='true';loading.hidden=true;resize();
  addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;unsubscribeConfig();renderer.setAnimationLoop(null);resizeObserver.disconnect();viewportObserver.disconnect();document.removeEventListener('visibilitychange',visibility);controls.dispose();for(const type of Object.values(resources))for(const item of type)item.dispose();renderer.dispose();});
}catch(error){loading.hidden=false;loading.textContent='The preview needs WebGL. Open it in a browser with hardware acceleration enabled.';stage.setAttribute('aria-busy','false');console.error(error);throw error;}

}
