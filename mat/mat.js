import * as THREE from 'three';
import {RoundedBoxGeometry} from '../assets/RoundedBoxGeometry.js';
const stage=document.querySelector('#stage');
try {
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Blue 24 by 14 cutting mat with adjustable lighting');
const scene=new THREE.Scene();scene.background=new THREE.Color('#c3c1b8');
const camera=new THREE.OrthographicCamera(-15,15,10,-10,.1,150);camera.position.set(0,0,33);camera.up.set(0,1,0);camera.lookAt(0,0,0);
function texture(){const c=document.createElement('canvas');c.width=3072;c.height=1792;const x=c.getContext('2d');x.fillStyle='#214c9b';x.fillRect(0,0,c.width,c.height);let seed=73;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};for(let i=0;i<190000;i++){x.fillStyle=i%2?'rgba(255,255,255,.025)':'rgba(0,10,45,.04)';x.fillRect(random()*c.width,random()*c.height,1+random()*2,1+random()*2);}
const margin=150,step=(c.width-margin*2)/24,top=(c.height-step*14)/2;const line=(a,b,d,e,alpha,width=2)=>{x.strokeStyle=`rgba(223,235,245,${alpha})`;x.lineWidth=width;x.beginPath();x.moveTo(a,b);x.lineTo(d,e);x.stroke();};
for(let i=0;i<=48;i++){let p=margin+i*step/2;line(p,top,p,top+14*step,i%2?.22:.52,i%2?1.5:2.4);}for(let i=0;i<=28;i++){let p=top+i*step/2;line(margin,p,c.width-margin,p,i%2?.22:.52,i%2?1.5:2.4);}
x.strokeStyle='rgba(232,241,249,.7)';x.lineWidth=2.5;x.strokeRect(28,28,c.width-56,c.height-56);x.fillStyle='rgba(232,241,249,.8)';x.font='38px Arial';x.textAlign='center';
for(let i=0;i<=192;i++){const p=margin+i*step/8,len=i%8===0?30:i%4===0?23:i%2===0?15:9;line(p,29,p,29+len,.7,2);line(p,c.height-29,p,c.height-29-len,.7,2);if(i%8===0){x.fillText(i/8,p,85);x.fillText(i/8,p,c.height-63);}}
for(let i=0;i<=112;i++){const p=top+i*step/8,len=i%8===0?28:i%4===0?20:10;line(29,p,29+len,p,.7,2);line(c.width-29,p,c.width-29-len,p,.7,2);if(i%8===0){x.fillText(i/8,77,p+10);x.fillText(i/8,c.width-77,p+10);}}

const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;}
function grain(){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');const d=x.createImageData(512,512);let s=931;for(let i=0;i<d.data.length;i+=4){s=s*16807%2147483647;const v=110+(s%35);d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}x.putImageData(d,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(12,7);return t;}
const body=new THREE.Mesh(new RoundedBoxGeometry(24,14,.085,3,.065),new THREE.MeshStandardMaterial({color:'#173b7a',roughness:.78}));body.position.z=.025;body.castShadow=true;body.receiveShadow=true;scene.add(body);
const face=new THREE.Mesh(new THREE.PlaneGeometry(23.98,13.98,320,20),new THREE.MeshStandardMaterial({map:texture(),bumpMap:grain(),bumpScale:.018,roughness:.69,metalness:0,side:THREE.DoubleSide}));face.position.z=.069;face.receiveShadow=true;scene.add(face);
// Bend the actual gridded surface into a spiral, progressively laying it flat.
const flatPositions=face.geometry.attributes.position.array.slice();
const positions=face.geometry.attributes.position;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let rolloutFrame=0;
function shapeRoll(progress){
  const front=-11.99+23.98*progress,remaining=23.98*(1-progress),pitch=.018;
  const outerRadius=Math.sqrt(.32*.32+2*pitch*remaining);
  for(let i=0;i<positions.count;i++){
    const x=flatPositions[i*3],y=flatPositions[i*3+1],length=x-front;
    if(length<=0||progress>=1){positions.setXYZ(i,x,y,0);continue;}
    const theta=(outerRadius-Math.sqrt(Math.max(.0001,outerRadius*outerRadius-2*pitch*length)))/pitch;
    const radius=outerRadius-pitch*theta;
    positions.setXYZ(i,front+radius*Math.sin(theta)-pitch*Math.cos(theta)+pitch,y,outerRadius-radius*Math.cos(theta)-pitch*Math.sin(theta));
  }
  positions.needsUpdate=true;face.geometry.computeVertexNormals();
  body.visible=progress>=1;face.castShadow=progress<1;
}
function rollout(){
  cancelAnimationFrame(rolloutFrame);
  if(reducedMotion.matches){shapeRoll(1);render();return;}
  const start=performance.now();document.getElementById('rollout').disabled=true;
  stage.setAttribute('aria-busy','true');
  function tick(now){
    const t=Math.min(1,(now-start)/2600),p=t*t*(3-2*t);
    shapeRoll(p);render();
    if(t<1)rolloutFrame=requestAnimationFrame(tick);
    else{document.getElementById('rollout').disabled=false;stage.setAttribute('aria-busy','false');}
  }
  shapeRoll(0);rolloutFrame=requestAnimationFrame(tick);
}
document.getElementById('rollout').addEventListener('click',rollout);
reducedMotion.addEventListener('change',()=>{cancelAnimationFrame(rolloutFrame);shapeRoll(1);document.getElementById('rollout').disabled=false;stage.setAttribute('aria-busy','false');render();});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#c3c1b8',roughness:1}));ground.position.z=-.08;ground.receiveShadow=true;scene.add(ground);
scene.add(new THREE.AmbientLight('#eef3ff',.7));const light=new THREE.PointLight('#ffffff',150,0,2);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.bias=-.0004;light.shadow.normalBias=.025;light.shadow.radius=4;scene.add(light);
const fill=new THREE.DirectionalLight('#dce7ff',.6);fill.position.set(8,7,15);scene.add(fill);
const fields=['direction','height','power','warmth'];const read=id=>Number(document.getElementById(id).value);function render(){renderer.render(scene,camera);}function update(){const az=THREE.MathUtils.degToRad(read('direction')),el=THREE.MathUtils.degToRad(read('height')),radius=19;light.position.set(Math.sin(az)*Math.cos(el)*radius,Math.cos(az)*Math.cos(el)*radius,Math.sin(el)*radius);light.intensity=read('power')*5.2;const w=read('warmth')/100;light.color.copy(new THREE.Color('#ffffff').lerp(new THREE.Color(w<0?'#a5c5ff':'#ffbe80'),Math.abs(w)*.7));for(const id of fields)document.getElementById(id+'-value').value=id==='direction'||id==='height'?read(id)+'°':id==='power'?read(id)+'%':w===0?'Neutral':w<0?'Cool '+Math.abs(read(id))+'%':'Warm '+read(id)+'%';render();}
for(const id of fields)document.getElementById(id).addEventListener('input',()=>{document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));update();});
const presets={daylight:[-45,55,70,0],raking:[-75,20,65,-12],evening:[60,35,45,70]};function setPreset(name){fields.forEach((id,i)=>document.getElementById(id).value=presets[name][i]);document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.preset===name));update();}document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>setPreset(b.dataset.preset)));document.getElementById('reset').addEventListener('click',()=>setPreset('daylight'));
let dragging=false;stage.addEventListener('pointerdown',e=>{dragging=true;stage.setPointerCapture(e.pointerId);});stage.addEventListener('pointermove',e=>{if(!dragging)return;const b=stage.getBoundingClientRect(),nx=(e.clientX-b.left)/b.width-.5,ny=(e.clientY-b.top)/b.height-.5;document.getElementById('direction').value=Math.atan2(nx,-ny)*180/Math.PI;document.getElementById('height').value=Math.round(85-Math.min(1,Math.hypot(nx,ny)*1.4)*65);document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));update();});stage.addEventListener('pointerup',()=>dragging=false);stage.addEventListener('pointercancel',()=>dragging=false);
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);const aspect=w/h,halfHeight=Math.max(8.2,13.2/aspect);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.position.set(0,0,33);camera.lookAt(0,0,0);camera.updateProjectionMatrix();render();}new ResizeObserver(resize).observe(stage);document.getElementById('loading').remove();stage.dataset.ready='true';resize();update();rollout();
} catch(error){document.getElementById('loading').textContent='This light study needs WebGL. Try opening it in a browser with hardware acceleration enabled.';console.error(error);}
