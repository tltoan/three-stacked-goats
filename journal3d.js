import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLeatherMaterials } from './leather-materials.js?v=7';

// An appearance model based on the photographed journal, not dimensioned CAD.
const PAPER = { ivory: '#eeeadd', blue: '#274abb', black: '#242424' };
const TAU = Math.PI * 2;
const COVER = { width: 2.45, height: 3.90, radius: .29, thickness: .052, corner: .115 };
const SPINE_LENGTH = Math.PI * COVER.radius;
const STRIP_LENGTH = COVER.width * 2 + SPINE_LENGTH;
const SPINE_ANCHORS = { top: 1.65, center: 0, bottom: -1.43, bottomReturn: -1.79 };
// Small punched openings, measured in the flat hide before it bends. The lower
// doubled elastic bridges two punches; it does not hang from a single dot.
const SPINE_APERTURES = [
  { y: SPINE_ANCHORS.top, rx: .052, ry: .068 },
  { y: SPINE_ANCHORS.center, rx: .043, ry: .038 },
  { y: SPINE_ANCHORS.bottom, rx: .053, ry: .064 },
  { y: SPINE_ANCHORS.bottomReturn, rx: .050, ry: .052 },
];
function random(seed = 407) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function texture(canvas) { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function sheet(w, h, depth, r) {
  const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), { depth, steps: 1, bevelEnabled: true, bevelThickness: .0018, bevelSize: .002, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getY(i) / h + .5);
  return g;
}
function pageTexture(type, color) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 1024;
  const ctx = c.getContext('2d'), rnd = random(881), dark = color !== 'ivory';
  ctx.fillStyle = PAPER[color] || PAPER.ivory; ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 43000; i++) {
    ctx.fillStyle = i % 2 ? `rgba(255,255,255,${rnd() * .055})` : `rgba(0,0,0,${rnd() * .045})`;
    ctx.fillRect(rnd() * c.width, rnd() * c.height, .8, .8);
  }
  ctx.strokeStyle = dark ? 'rgba(221,221,221,.64)' : 'rgba(68,75,63,.30)';
  ctx.fillStyle = dark ? 'rgba(221,221,221,.79)' : 'rgba(68,75,63,.42)';
  if (type === 'lined') {
    ctx.lineWidth = 1.2;
    for (let y = 80; y < 980; y += 38) { ctx.beginPath(); ctx.moveTo(49, y); ctx.lineTo(719, y); ctx.stroke(); }
  } else if (type === 'dotted') {
    for (let y = 64; y < 985; y += 31) for (let x = 49; x < 730; x += 31) { ctx.beginPath(); ctx.arc(x, y, 1.55, 0, TAU); ctx.fill(); }
  }
  return texture(c);
}
function tube(points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(48, points.length * 10), radius, 10, closed), material);
  mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

function makeDimensionOverlay(container) {
  const overlay = document.createElement('div'); overlay.className = 'journal-dimensions';
  overlay.setAttribute('role','img'); overlay.setAttribute('aria-label','Closed journal: 5 inches tall by 4 inches wide.');
  const axes = [
    { name:'height', text:'5 in', width:43.0128, height:423.253 },
    { name:'width', text:'4 in', width:65.9735, height:277.228 }
  ].map(axis => {
    const image = document.createElement('img'), label = document.createElement('span');
    image.src = `./assets/dimension-${axis.name}.svg`; image.alt = ''; image.draggable = false;
    label.textContent = axis.text; label.setAttribute('aria-hidden','true');
    overlay.append(image,label); return {...axis,image,label};
  });
  container.append(overlay);
  function setVisible(visible) { overlay.dataset.visible = String(visible); overlay.setAttribute('aria-hidden',String(!visible)); }
  function place(axis, start, end, center, gap) {
    const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
    let nx=-dy/length,ny=dx/length;
    const mx=(start.x+end.x)/2,my=(start.y+end.y)/2;
    if(nx*(mx-center.x)+ny*(my-center.y)<0){nx=-nx;ny=-ny;}
    const x=start.x+nx*gap,y=start.y+ny*gap;
    axis.endpoints=[{x,y},{x:end.x+nx*gap,y:end.y+ny*gap}];
    // Keep the original Figma SVG intact; align its diagonal to the projected edge.
    const nativeDX=1-axis.width,nativeDY=axis.height;
    const scale=length/Math.hypot(nativeDX,nativeDY);
    const angle=Math.atan2(dy,dx)-Math.atan2(nativeDY,nativeDX);
    const a=scale*Math.cos(angle),b=scale*Math.sin(angle),originX=axis.width-.5;
    axis.image.style.transform=`matrix(${a},${b},${-b},${a},${x-a*originX},${y-b*originX})`;
    let labelAngle=Math.atan2(dy,dx)*180/Math.PI;
    if(labelAngle>90)labelAngle-=180;else if(labelAngle<-90)labelAngle+=180;
    axis.label.style.left=`${mx+nx*(gap+14)}px`;axis.label.style.top=`${my+ny*(gap+14)}px`;
    axis.label.style.transform=`translate(-50%,-50%) rotate(${labelAngle}deg)`;
  }
  function update({visible,points,center,width,height}) {
    if(!visible){setVisible(false);return;}
    const [topLeft,bottomLeft,bottomRight]=points;
    const edgeWidth=Math.hypot(bottomRight.x-bottomLeft.x,bottomRight.y-bottomLeft.y);
    const edgeHeight=Math.hypot(bottomLeft.x-topLeft.x,bottomLeft.y-topLeft.y);
    if(points.some(p=>p.z<-1||p.z>1)||edgeWidth<42||edgeHeight<65){setVisible(false);return;}
    const gap=width<500?12:18;
    // Give the height annotation more space from the leather and spine fittings.
    const heightGap=width<500?24:36;
    place(axes[0],topLeft,bottomLeft,center,heightGap);place(axes[1],bottomLeft,bottomRight,center,gap);
    const inFrame=axes.every(axis=>{const x=parseFloat(axis.label.style.left),y=parseFloat(axis.label.style.top);return x>20&&x<width-20&&y>20&&y<height-20&&axis.endpoints.every(p=>p.x>2&&p.x<width-2&&p.y>2&&p.y<height-2);});
    setVisible(inFrame);
  }
  setVisible(false); return {update,dispose(){overlay.remove();}};
}

// A single gridded hide. Its center bends continuously through the spine while
// both leather surfaces and the raw perimeter follow the same deformation.
function makeLeatherWrap(materials) {
  const U = 144, V = 76, count = (U + 1) * (V + 1);
  const group = new THREE.Group(), outerG = new THREE.BufferGeometry(), innerG = new THREE.BufferGeometry();
  const outerP = new Float32Array(count * 3), innerP = new Float32Array(count * 3), uv = new Float32Array(count * 2), frontIndices = [], innerIndices = [];
  const center = COVER.width + SPINE_LENGTH / 2;
  const cuts = SPINE_APERTURES.map(h => ({ ...h,
    u0: Math.floor((center-h.rx-.024)/STRIP_LENGTH*U), u1: Math.ceil((center+h.rx+.024)/STRIP_LENGTH*U),
    v0: Math.floor(((h.y-h.ry-.024)/COVER.height+.5)*V), v1: Math.ceil(((h.y+h.ry+.024)/COVER.height+.5)*V),
  }));
  for (let u = 0; u <= U; u++) for (let v = 0; v <= V; v++) {
    const i = u * (V + 1) + v; uv[i * 2] = u / U; uv[i * 2 + 1] = v / V;
    if (u < U && v < V && !cuts.some(h => u>=h.u0 && u<h.u1 && v>=h.v0 && v<h.v1)) { const a = i, b = i + V + 1, c = i + 1, d = b + 1; frontIndices.push(a,b,c,b,d,c); innerIndices.push(a,c,b,b,c,d); }
  }
  outerG.setAttribute('position', new THREE.BufferAttribute(outerP, 3).setUsage(THREE.DynamicDrawUsage));
  innerG.setAttribute('position', new THREE.BufferAttribute(innerP, 3).setUsage(THREE.DynamicDrawUsage));
  outerG.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); innerG.setAttribute('uv', new THREE.BufferAttribute(uv.slice(), 2));
  outerG.setIndex(frontIndices); innerG.setIndex(innerIndices);
  const outer = new THREE.Mesh(outerG, materials.outer), inner = new THREE.Mesh(innerG, materials.inner);
  outer.castShadow = outer.receiveShadow = inner.castShadow = inner.receiveShadow = true;
  group.add(outer, inner);
  const perimeter = [];
  for (let u = 0; u <= U; u++) perimeter.push(u * (V + 1));
  for (let v = 1; v <= V; v++) perimeter.push(U * (V + 1) + v);
  for (let u = U - 1; u >= 0; u--) perimeter.push(u * (V + 1) + V);
  for (let v = V - 1; v > 0; v--) perimeter.push(v);
  const edgeP = new Float32Array(perimeter.length * 2 * 3), edgeUV = new Float32Array(perimeter.length * 2 * 2), edgeI = [];
  perimeter.forEach((_, i) => { edgeUV[i * 4] = edgeUV[i * 4 + 2] = i / perimeter.length * 4; edgeUV[i * 4 + 1] = 0; edgeUV[i * 4 + 3] = 1; const a = i * 2, b = ((i + 1) % perimeter.length) * 2; edgeI.push(a,a+1,b,b,a+1,b+1); });
  const edgeG = new THREE.BufferGeometry(); edgeG.setAttribute('position', new THREE.BufferAttribute(edgeP, 3).setUsage(THREE.DynamicDrawUsage)); edgeG.setAttribute('uv', new THREE.BufferAttribute(edgeUV, 2)); edgeG.setIndex(edgeI);
  const edge = new THREE.Mesh(edgeG, materials.edge); edge.castShadow = true; edge.receiveShadow = true; group.add(edge);
  // Replace each omitted grid patch with a leather ring around an actual hole.
  // Boundary points interpolate the adjacent grid edge, so folding cannot open
  // cracks between the patch and the rest of the hide.
  const cavityMaterial = new THREE.MeshBasicMaterial({color:'#100e0c'});
  const apertures = cuts.map(h => {
    const s0=STRIP_LENGTH*h.u0/U,s1=STRIP_LENGTH*h.u1/U,y0=(h.v0/V-.5)*COVER.height,y1=(h.v1/V-.5)*COVER.height;
    const angles=[];
    const angleOf=(s,y)=>angles.push((Math.atan2(y-h.y,s-center)+TAU)%TAU);
    for(let j=0;j<48;j++)angles.push(j/48*TAU);
    for(let u=h.u0;u<=h.u1;u++){const s=STRIP_LENGTH*u/U;angleOf(s,y0);angleOf(s,y1);}
    for(let v=h.v0;v<=h.v1;v++){const y=(v/V-.5)*COVER.height;angleOf(s0,y);angleOf(s1,y);}
    angles.sort((a,b)=>a-b);
    const rays=angles.filter((a,i)=>i===0||a-angles[i-1]>1e-7).map(a=>{
      const x=Math.cos(a),y=Math.sin(a),sx=(x>=0?s1-center:s0-center)/(x||1e-20),sy=(y>=0?y1-h.y:y0-h.y)/(y||1e-20),distance=Math.min(sx,sy);
      const s=center+x*distance,py=h.y+y*distance,radial=1/Math.sqrt((x/h.rx)**2+(y/h.ry)**2);
      const u=s/STRIP_LENGTH*U,v=(py/COVER.height+.5)*V,horizontal=sy<=sx;
      const ua=horizontal?Math.max(h.u0,Math.min(h.u1-1,Math.floor(u))):Math.round(u),va=horizontal?Math.round(v):Math.max(h.v0,Math.min(h.v1-1,Math.floor(v)));
      const ub=horizontal?ua+1:ua,vb=horizontal?va:va+1;
      return{s,y:py,hs:center+x*radial,hy:h.y+y*radial,a:ua*(V+1)+va,b:ub*(V+1)+vb,t:Math.max(0,Math.min(1,horizontal?u-ua:v-va))};
    });
    const n=rays.length,positions=new Float32Array(n*6),patchUV=new Float32Array(n*4),indices=[];
    rays.forEach((r,j)=>{
      patchUV[j*2]=r.s/STRIP_LENGTH;patchUV[j*2+1]=r.y/COVER.height+.5;
      patchUV[(n+j)*2]=r.hs/STRIP_LENGTH;patchUV[(n+j)*2+1]=r.hy/COVER.height+.5;
      const next=(j+1)%n;indices.push(j,next,n+j,next,n+next,n+j);
    });
    const front=new THREE.BufferGeometry();front.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));front.setAttribute('uv',new THREE.BufferAttribute(patchUV,2));front.setIndex(indices);
    const back=front.clone(),backIndices=indices.slice();for(let j=0;j<backIndices.length;j+=3)[backIndices[j+1],backIndices[j+2]]=[backIndices[j+2],backIndices[j+1]];back.setIndex(backIndices);
    const wall=new THREE.BufferGeometry(),wallPositions=new Float32Array(n*4*3),wallUV=new Float32Array(n*4*2),wallIndices=[];
    for(let level=0;level<4;level++)for(let j=0;j<n;j++){
      wallUV[(level*n+j)*2]=j/n;wallUV[(level*n+j)*2+1]=level/3;
      if(level<3){const a=level*n+j,b=level*n+(j+1)%n,c=a+n,d=b+n;wallIndices.push(a,b,c,b,d,c);}
    }
    wall.setAttribute('position',new THREE.BufferAttribute(wallPositions,3).setUsage(THREE.DynamicDrawUsage));wall.setAttribute('uv',new THREE.BufferAttribute(wallUV,2));wall.setIndex(wallIndices);
    // A shaded cavity sits beyond the inner lip. It prevents brightly dyed
    // inserts from lighting up the punch, while retaining the visible cut wall.
    // Its back face is omitted so the inside still reads as pierced leather.
    const cavity=new THREE.BufferGeometry(),cavityIndices=[];
    cavity.setAttribute('position',new THREE.BufferAttribute(new Float32Array((n+1)*3),3).setUsage(THREE.DynamicDrawUsage));
    for(let j=0;j<n;j++)cavityIndices.push(n,j,(j+1)%n);cavity.setIndex(cavityIndices);
    for(const [geometry,material] of [[front,materials.outer],[back,materials.inner],[wall,materials.edge],[cavity,cavityMaterial]]){const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
    return{...h,rays,n,front,back,wall,cavity};
  });
  let lastAngle = NaN;
  function point(s, y, angle, inset = 0) {
    const W = COVER.width, R = COVER.radius, k = angle / SPINE_LENGTH;
    let x, z, dx, dz;
    if (s < W) { x = W / 2 - s; z = -R; dx = -1; dz = 0; }
    else if (s <= W + SPINE_LENGTH) { const t = s - W, a = k * t; x = -W/2 - Math.sin(a) / k; z = -R + (1 - Math.cos(a)) / k; dx = -Math.cos(a); dz = Math.sin(a); }
    else { const t = s - W - SPINE_LENGTH; x = -W/2 - Math.sin(angle) / k - t * Math.cos(angle); z = -R + (1 - Math.cos(angle)) / k + t * Math.sin(angle); dx = -Math.cos(angle); dz = Math.sin(angle); }
    // The used hide has a narrow, soft fold, not a semicircular rigid channel.
    // Both ends retain the original position and tangent, so there is no seam
    // where this compressed curve meets either face of the cover.
    if (s >= W && s <= W + SPINE_LENGTH) {
      const u = (s - W) / SPINE_LENGTH, a = Math.PI * u, sine = Math.sin(a), cosine = Math.cos(a);
      const closed = Math.min(1, angle / Math.PI), open = 1 - closed;
      const holes = Math.exp(-(((y - SPINE_ANCHORS.top) / .18) ** 2)) + Math.exp(-(((y - SPINE_ANCHORS.bottom) / .15) ** 2)) + .8*Math.exp(-(((y - SPINE_ANCHORS.bottomReturn) / .12) ** 2)) + .45*Math.exp(-((y / .13) ** 2));
      const crease = open * (.043 + .010 * Math.sin(y * 1.15 + .35));
      const squeeze = -.088 * closed ** 1.4, pucker = -.023 * holes;
      const profile = squeeze * sine ** 2 + crease * sine ** 4 + pucker * sine ** 8;
      const derivative = Math.PI / SPINE_LENGTH * cosine * (2 * squeeze * sine + 4 * crease * sine ** 3 + 8 * pucker * sine ** 7);
      const cx = -Math.sin(angle / 2), cz = -Math.cos(angle / 2);
      x += cx * profile; z += cz * profile; dx += cx * derivative; dz += cz * derivative;
    }
    const length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
    const face = s < W ? s / W : s > W + SPINE_LENGTH ? (STRIP_LENGTH - s) / W : 1;
    const yRatio = y / (COVER.height / 2), nearEnd = Math.min(s, STRIP_LENGTH - s);
    const faceWeight = Math.max(0, 1 - Math.pow(Math.min(1, face), 6));
    const bow = .035 * Math.sin(Math.PI * Math.min(face, 1)) ** 2 * (.6 + .4 * Math.cos(y * 1.05));
    const curl = .055 * Math.exp(-nearEnd * 5) * (.35 + .65 * yRatio * yRatio);
    const edgeRoll = .006 * Math.pow(Math.abs(yRatio), 10) * (.65 + .35 * Math.sin(s * .92 + .8)) * faceWeight;
    const dimple = -.018 * Math.exp(-Math.pow(y * 4.5, 2)) * faceWeight;
    const displacement = bow + curl + edgeRoll + dimple + inset;
    return { x: x + nx * displacement, y, z: z + nz * displacement, nx, nz };
  }
  function update(angle, force = false) {
    angle = Math.max(.015, angle);
    if (!force && Math.abs(angle - lastAngle) < .00002) return;
    lastAngle = angle;
    for (let u = 0; u <= U; u++) {
      const s = STRIP_LENGTH * u / U, d = Math.min(s, STRIP_LENGTH - s), r = COVER.corner;
      const ymax = COVER.height / 2 - (d < r ? r - Math.sqrt(Math.max(0, r*r - (r-d)*(r-d))) : 0);
      for (let v = 0; v <= V; v++) {
        const y = (v / V * 2 - 1) * ymax, i = (u * (V + 1) + v) * 3;
        const p = point(s, y, angle), half = COVER.thickness / 2;
        outerP[i] = p.x + p.nx * half; outerP[i+1] = p.y; outerP[i+2] = p.z + p.nz * half;
        innerP[i] = p.x - p.nx * half; innerP[i+1] = p.y; innerP[i+2] = p.z - p.nz * half;
      }
    }
    perimeter.forEach((n, i) => { for (let a = 0; a < 3; a++) { edgeP[i*6+a] = outerP[n*3+a]; edgeP[i*6+3+a] = innerP[n*3+a]; } });
    for (const g of [outerG, innerG, edgeG]) { g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); }
    for(const h of apertures){
      for(const [g,source,inset] of [[h.front,outerP,COVER.thickness/2],[h.back,innerP,-COVER.thickness/2]]){
        const a=g.attributes.position.array;
        h.rays.forEach((r,j)=>{for(let k=0;k<3;k++)a[j*3+k]=THREE.MathUtils.lerp(source[r.a*3+k],source[r.b*3+k],r.t);const p=point(r.hs,r.hy,angle,inset);a[(h.n+j)*3]=p.x;a[(h.n+j)*3+1]=p.y;a[(h.n+j)*3+2]=p.z;});
      }
      // A very small rounded cut edge exposes the leather's thickness. There is
      // no metal eyelet or surface decal hiding the cord ends.
      const levels=[[1,COVER.thickness/2],[.88,COVER.thickness/2-.012],[.88,-COVER.thickness/2+.012],[1,-COVER.thickness/2]],a=h.wall.attributes.position.array;
      levels.forEach(([scale,inset],level)=>h.rays.forEach((r,j)=>{const p=point(center+(r.hs-center)*scale,h.y+(r.hy-h.y)*scale,angle,inset),at=(level*h.n+j)*3;a[at]=p.x;a[at+1]=p.y;a[at+2]=p.z;}));
      const c=h.cavity.attributes.position.array,cavityDepth=-COVER.thickness/2-.008;
      h.rays.forEach((r,j)=>{const p=point(center+(r.hs-center)*1.10,h.y+(r.hy-h.y)*1.10,angle,cavityDepth);c[j*3]=p.x;c[j*3+1]=p.y;c[j*3+2]=p.z;});
      const p=point(center,h.y,angle,cavityDepth);c[h.n*3]=p.x;c[h.n*3+1]=p.y;c[h.n*3+2]=p.z;
      for(const g of [h.front,h.back,h.wall,h.cavity]){g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();}
    }
  }
  update(Math.PI, true);
  return { group, update, point };
}
// Small cords pass through the hide's punched apertures. Their attachment points
// follow the deformed surface; there is no separate structural spine component.
// A height map presses the mark into the metal, rather than printing ink on it.
export function engravedBrass(base, geometry) {
  const material = base.clone();
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1024, 512);
  const bump = new THREE.CanvasTexture(canvas);
  bump.colorSpace = THREE.NoColorSpace; bump.anisotropy = 8;
  material.bumpMap = bump; material.bumpScale = .001;
  Promise.all([0].map(n => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject;
    image.src = new URL('./assets/logo-dock-body.svg', import.meta.url).href;
  }))).then(images => {
    const ink = document.createElement('canvas'); ink.width = 534; ink.height = 1074;
    const draw = ink.getContext('2d'); images.forEach(image => draw.drawImage(image, 0, 0, 534, 1074));
    const data = draw.getImageData(0,0,534,1074).data;
    let x0=534,y0=1074,x1=0,y1=0;
    for(let y=0;y<1074;y++) for(let x=0;x<534;x++) if(data[(y*534+x)*4+3]>100){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    // Cylinder circumference is about twice its height. Preserve the logo's
    // proportions in physical space and leave a generous unmarked metal rim.
    const height=410, width=height*(x1-x0+1)/(y1-y0+1);
    ctx.drawImage(ink,x0,y0,x1-x0+1,y1-y0+1,512-width/2,51,width,height);
    // Cut the actual sleeve surface inward. A softened mask makes a small
    // bevel at the lip; recomputed normals let it catch the moving light.
    const soft=document.createElement('canvas'); soft.width=1024; soft.height=512;
    const sc=soft.getContext('2d'); sc.filter='blur(1.6px)'; sc.drawImage(canvas,0,0);
    const heights=sc.getImageData(0,0,1024,512).data;
    const position=geometry.attributes.position, uv=geometry.attributes.uv;
    for(let i=0;i<position.count;i++){
      const x=Math.min(1023,Math.round(uv.getX(i)*1023));
      const y=Math.min(511,Math.round((1-uv.getY(i))*511));
      const depth=(1-heights[(y*1024+x)*4]/255)*.006;
      const px=position.getX(i),pz=position.getZ(i),r=Math.hypot(px,pz);
      position.setXYZ(i,px*(r-depth)/r,position.getY(i),pz*(r-depth)/r);
    }
    position.needsUpdate=true; geometry.computeVertexNormals();
    // The cavity remains brass, with restrained occlusion inside the cut.
    const shade=document.createElement('canvas'); shade.width=1024; shade.height=512;
    const sh=shade.getContext('2d'); sh.fillStyle='white'; sh.fillRect(0,0,1024,512);
    sh.globalAlpha=.42; sh.drawImage(canvas,0,0);
    const color=new THREE.CanvasTexture(shade); color.colorSpace=THREE.SRGBColorSpace;
    material.map=color; material.needsUpdate=true;
    ctx.clearRect(0,0,1024,512); ctx.drawImage(soft,0,0);
    bump.needsUpdate=true;
  }).catch(error => console.warn('Brass engraving unavailable', error));
  return material;
}
function makeSpineDetails(wrap, materials) {
  const group = new THREE.Group(), paths = [], center = COVER.width + SPINE_LENGTH / 2;
  const outside = COVER.thickness / 2;
  // Closure opacity is independent, while its tint follows every leather change.
  const looseMaterial = materials.cord.clone(); looseMaterial.color = materials.cord.color; looseMaterial.transparent = true;
  function cord(coords, radius = .012, material = materials.cord, closed = false) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material); mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh); paths.push({ mesh, coords, radius, closed }); return mesh;
  }
  // The upper U hangs below its pressed brass sleeve. Both tips continue
  // through the leather instead of stopping on its outside surface.
  cord([[-.020,SPINE_ANCHORS.top,-.040],[-.022,1.625,.003],[-.028,1.60,outside+.027],[-.022,1.51,outside+.037],[.006,1.49,outside+.039],[.030,1.54,outside+.035],[.024,1.625,.003],[.020,SPINE_ANCHORS.top,-.040]], .016);
  // Two close legs bridge the lower entry and return punches. Each turn is on
  // the inside of the hide, so there is no floating U or exposed endpoint below.
  cord([[-.018,SPINE_ANCHORS.bottom,-.040],[-.019,-1.45,0],[-.026,-1.49,outside+.012],[-.029,-1.62,outside+.020],[-.023,-1.73,outside+.015],[-.018,-1.77,0],[-.016,SPINE_ANCHORS.bottomReturn,-.040],[.016,SPINE_ANCHORS.bottomReturn,-.040],[.018,-1.77,0],[.026,-1.72,outside+.013],[.029,-1.60,outside+.020],[.022,-1.49,outside+.013],[.019,-1.45,0],[.018,SPINE_ANCHORS.bottom,-.040],[0,SPINE_ANCHORS.bottom,-.045]], .016, materials.cord, true);
  // The relaxed closure still ends at the central aperture; it does not carry
  // a separate decorative knot over the closed retaining band.
  const loose = cord([[-.012,-.008,-.038],[.006,.008,0],[.15,.035,outside+.054],[.46,.24,outside+.085],[.64,.83,outside+.09],[.53,1.37,outside+.071],[.22,1.49,outside+.054],[-.024,.77,outside+.050],[.016,.013,0],[.012,.006,-.038]], .019, looseMaterial);
  const keeper = new THREE.Group(), keeperRadius = .065, keeperLength = .20;
  keeper.scale.z = .52;
  const barrelGeometry = new THREE.CylinderGeometry(keeperRadius,keeperRadius+.002,keeperLength,512,192,true);
  barrelGeometry.rotateY(Math.PI);
  const barrel = new THREE.Mesh(barrelGeometry, engravedBrass(materials.brass, barrelGeometry));
  barrel.castShadow = barrel.receiveShadow = true; keeper.add(barrel);
  for (const end of [-1,1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(keeperRadius-.001,.003,8,24), materials.brass);
    rim.rotation.x = Math.PI / 2; rim.position.y = end * keeperLength / 2; keeper.add(rim);
  }
  group.add(keeper); let lastAngle = NaN;
  function update(angle, force = false) {
    angle = Math.max(.015, angle); if (!force && Math.abs(angle - lastAngle) < .00002) return; lastAngle = angle;
    for (const path of paths) {
      const vertices = path.coords.map(([s,y,offset]) => { const p = wrap.point(center+s,y,angle,offset); return new THREE.Vector3(p.x,p.y,p.z); });
      const curve = new THREE.CatmullRomCurve3(vertices,path.closed,'centripetal');
      const geometry = new THREE.TubeGeometry(curve,Math.max(48,vertices.length*9),path.radius,8,path.closed);
      path.mesh.geometry.dispose(); path.mesh.geometry = geometry;
    }
    const p = wrap.point(center+.002,1.735,angle,outside+.027); keeper.position.set(p.x,p.y,p.z); keeper.rotation.y = Math.atan2(p.nx,p.nz); keeper.rotation.z = -.045;
  }
  function setClosure(amount) { looseMaterial.opacity = 1-amount; loose.visible = amount < .98; }
  update(Math.PI); setClosure(1); return { group, update, setClosure, keeper };
}
// Retaining elastics belong to the leather, not to the removable booklets.
// Each installed booklet slips under a run at its center fold. The runs settle
// back against the suede when the books are removed in the exploded view.
function makeInsertRetainers(wrap, materials, inserts) {
  const group = new THREE.Group(), center = COVER.width + SPINE_LENGTH / 2;
  const inside = -COVER.thickness / 2, ys = [SPINE_ANCHORS.bottom,-1.72,-1.81,-1.73,-.8,0,.8,1.73,1.81,1.75,SPINE_ANCHORS.top];
  const runs = inserts.map(() => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), materials.cord);
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    return { mesh, previous: [] };
  });
  function update(angle, attached) {
    inserts.forEach((book, i) => {
      book.group.updateMatrix();
      const s = (i - 1) * .056;
      const points = ys.map((y, j) => {
        const endpoint = j === 0 || j === ys.length - 1;
        const restY = THREE.MathUtils.lerp(SPINE_ANCHORS.bottom,SPINE_ANCHORS.top,j/(ys.length-1));
        // Gather the three runs into the same punched opening. The endpoint is
        // inside the thickness, aligned with the external cord's entry path.
        const p = wrap.point(center+(endpoint?(i-1)*.019:s), restY, angle, endpoint?-.014:inside-.017);
        const rest = new THREE.Vector3(p.x,p.y,p.z);
        if (endpoint) return rest;
        // Turn over the top/bottom edges before passing through the middle.
        const edgeTurn = j === 1 || j === ys.length - 2;
        const middle = new THREE.Vector3(-1.17,y,edgeTurn ? -.065 : .011).applyMatrix4(book.group.matrix);
        return rest.lerp(middle, attached);
      });
      const run = runs[i];
      if (run.previous.length && points.every((p,j) => p.distanceToSquared(run.previous[j]) < 1e-9)) return;
      const curve = new THREE.CatmullRomCurve3(points,false,'centripetal');
      const geometry = new THREE.TubeGeometry(curve,96,.0105,8,false);
      run.mesh.geometry.dispose(); run.mesh.geometry = geometry; run.previous = points;
    });
  }
  return { group, update };
}
function makeClosedClosure(wrap, material) {
  const center=COVER.width+SPINE_LENGTH/2,outside=COVER.thickness/2,points=[];
  const add=(s,y,offset)=>{const p=wrap.point(s,y,Math.PI,offset);points.push([p.x,p.y,p.z]);};
  // Both ends enter the center hole. The lower branch crosses toward the back,
  // and the upper branch returns with a small lifted diagonal overlap.
  add(center+.024,.012,outside-.009);
  add(center+.030,.027,outside+.008);
  add(center-.020,-.020,outside+.037);
  add(center-.120,-.050,outside+.025);
  for(let i=0;i<=48;i++){
    const s=(center-.14)*(1-i/48),dy=s-center;
    add(s,-.015-.04*Math.exp(-((dy/.55)**2)),outside+.025);
  }
  const backEnd=points[points.length-1];
  const front=wrap.point(STRIP_LENGTH,-.015,Math.PI,outside+.025),foreX=COVER.width/2;
  points.push([foreX+.025,-.015,backEnd[2]+.002],[foreX+.055,-.015,backEnd[2]+.023],[foreX+.070,-.015,backEnd[2]+.070],[foreX+.070,-.015,0],[foreX+.070,-.015,front.z-.070],[foreX+.055,-.015,front.z-.023],[foreX+.025,-.015,front.z-.002]);
  for(let i=0;i<=48;i++){
    const s=THREE.MathUtils.lerp(STRIP_LENGTH,center+.14,i/48),dy=s-center;
    add(s,-.015+.055*Math.exp(-((dy/.55)**2)),outside+.025);
  }
  add(center+.10,.041,outside+.035);
  add(center+.030,.034,outside+.080);
  add(center-.018,.004,outside+.071);
  add(center-.012,-.008,outside-.009);
  return tube(points,.019,material);
}
function studioEnvironment(renderer, size = window.innerWidth <= 700 ? 512 : 1024) {
  const studio = new THREE.Scene(); studio.background = new THREE.Color('#383838');
  // Feathered, high-resolution softboxes keep reflected light continuous. The
  // material's fine normals supply the grain, not a low-resolution light edge.
  const softboxCanvas = document.createElement('canvas'); softboxCanvas.width = softboxCanvas.height = 256;
  const ctx = softboxCanvas.getContext('2d');
  const glow = ctx.createRadialGradient(128,128,42,128,128,170);
  glow.addColorStop(0,'#ffffff'); glow.addColorStop(.55,'#f5f5f5'); glow.addColorStop(1,'#000000');
  ctx.fillStyle = glow; ctx.fillRect(0,0,256,256);
  const softbox = new THREE.CanvasTexture(softboxCanvas); softbox.colorSpace = THREE.SRGBColorSpace;
  const addPanel = (size, position, intensity) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(intensity), map: softbox, side: THREE.DoubleSide })); p.position.set(...position); p.lookAt(0,0,0); studio.add(p); };
  addPanel([4.5,8], [-4.3,-1.2,7], 5.0);
  addPanel([1.8,7], [4.8,1.4,3], 1.4);
  addPanel([6,3], [0,7,-2], 2.4);
  addPanel([5,8], [3,-.5,-7], 4.5);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const result = pmrem.fromScene(studio, 0, .1, 40, { size });
  studio.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); softbox.dispose(); pmrem.dispose(); return result;
}
export function createJournalViewer(container, initialState = {}) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)'), scene = new THREE.Scene();
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
  catch(error) { container.dispatchEvent(new CustomEvent('journal-error',{detail:error})); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0xdddcd6, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;outline:none;';
  renderer.domElement.setAttribute('aria-label','Interactive leather journal. Drag or use arrow keys to rotate.'); renderer.domElement.setAttribute('role','img');
  container.appendChild(renderer.domElement); if (!container.hasAttribute('tabindex')) container.tabIndex = 0;
  const camera = new THREE.PerspectiveCamera(31, 1, .1, 100), controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = controls.enableZoom = false; controls.enableDamping = true; controls.dampingFactor = .09; controls.rotateSpeed = .65;
  controls.minPolarAngle = .25; controls.maxPolarAngle = Math.PI-.25; controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  renderer.domElement.style.touchAction = 'pan-y'; controls.mouseButtons.RIGHT = undefined;
  const env = studioEnvironment(renderer); scene.environment = env.texture; scene.environmentIntensity = .72;
  scene.add(new THREE.HemisphereLight('#ffffff', '#5b5b5b', .65));
  const key = new THREE.DirectionalLight('#ffffff', 2.1); key.position.set(-4,7,6); key.castShadow = true; key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-7,right:7,top:6,bottom:-6,near:.1,far:25}); key.shadow.normalBias=.025; key.shadow.bias=-.0003; key.shadow.radius=5; key.shadow.blurSamples=8; scene.add(key);
  const fill = new THREE.DirectionalLight('#ffffff', .35); fill.position.set(5,1,3); scene.add(fill);
  const backFill = new THREE.DirectionalLight('#ffffff', 1.4); backFill.position.set(3,5,-6); scene.add(backFill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.10})); floor.rotation.x=-Math.PI/2; floor.position.y=-2.16; floor.receiveShadow=true; scene.add(floor);
  const root = new THREE.Group(); scene.add(root);
  const dimensions = makeDimensionOverlay(container);
  const materials = createLeatherMaterials(THREE), wrap = makeLeatherWrap(materials); root.add(wrap.group);
  const closureMaterial = materials.cord.clone(); closureMaterial.color = materials.cord.color; closureMaterial.transparent = true;
  const closure = makeClosedClosure(wrap,closureMaterial); root.add(closure);
  const spineDetails = makeSpineDetails(wrap,materials); root.add(spineDetails.group);
  const textures = new Map(), inserts=[];
  const paperMap=(type,color)=>{const id=type+':'+color;if(!textures.has(id))textures.set(id,pageTexture(type,color));return textures.get(id);};
  const paperG=sheet(2.34,3.52,.065,.075), kraftG=sheet(2.37,3.56,.014,.08);
  function leafEdges(half, material, seed) {
    const rnd=random(seed),positions=[];
    for(let j=1;j<12;j++) { const z=-.0325+j*.0058,trim=(rnd()-.5)*.009;
      for(let k=0;k<24;k++){const y=-1.66+k*3.32/24,yn=-1.66+(k+1)*3.32/24;positions.push(1.171+trim,y,z,1.171+trim,yn,z+(rnd()-.5)*.0009);}
      positions.push(-1.07,1.761+trim,z,1.07,1.761+trim,z,-1.07,-1.761-trim,z,1.07,-1.761-trim,z);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));half.add(new THREE.LineSegments(g,material));
  }
  for(let i=0;i<3;i++) {
    const group=new THREE.Group(); root.add(group);
    const pageMat=new THREE.MeshStandardMaterial({roughness:.96,metalness:0,map:paperMap('sketch','ivory'),envMapIntensity:.12});
    const edgeMat=new THREE.MeshStandardMaterial({color:PAPER.ivory,roughness:1,envMapIntensity:.1});
    const lineM=new THREE.LineBasicMaterial({color:'#bcb8aa',transparent:true,opacity:.55});
    const lower=new THREE.Group();lower.position.z=-.036;group.add(lower);
    const right=new THREE.Mesh(paperG,[pageMat,edgeMat]);right.castShadow=right.receiveShadow=true;lower.add(right);leafEdges(lower,lineM,40+i);
    const bottom=new THREE.Mesh(kraftG,materials.kraft);bottom.position.z=-.081;bottom.castShadow=true;group.add(bottom);
    const turn=new THREE.Group();turn.position.set(-1.17,0,.002);group.add(turn);
    const upper=new THREE.Group();upper.position.set(1.17,0,.038);turn.add(upper);
    const left=new THREE.Mesh(paperG,[pageMat,edgeMat]);left.castShadow=left.receiveShadow=true;upper.add(left);leafEdges(upper,lineM,81+i);
    const frontCover=new THREE.Mesh(kraftG,materials.kraft);frontCover.position.set(1.17,0,.082);frontCover.castShadow=frontCover.receiveShadow=true;turn.add(frontCover);
    inserts.push({group,turn,frontCover,pageMat,edgeMat,lineM});
  }
  const retainers=makeInsertRetainers(wrap,materials,inserts);root.add(retainers.group);
  let state={leather:'brown',inserts:[{type:'sketch',color:'ivory'},{type:'lined',color:'ivory'},{type:'dotted',color:'ivory'}],activeInsert:0};
  let view='closed',disposed=false,active=true,requestId=0,lastTime=0,userMoved=false,width=1,height=1,cameraTween=true,fold=Math.PI,closureAmount=1,retentionAmount=1,pose;
  const goalCamera=new THREE.Vector3(),goalTarget=new THREE.Vector3(),emit=(name,detail)=>container.dispatchEvent(new CustomEvent(name,{detail}));
  function makePose(){
    const selected=Math.max(0,Math.min(2,state.activeInsert||0)),order=[selected,...[0,1,2].filter(i=>i!==selected)];
    if(view==='exploded')return{fold:.045,rootX:.8,rootY:0,rootZ:-.04,closure:0,positions:[[-3.15,-.13,1.6],[0,0,1.7],[3.15,.13,1.8]],angles:[0,0,0],coverZ:-.15,rotations:[-.035,0,.035]};
    if(view==='open')return{fold:.045,rootX:1.15,rootY:0,rootZ:-.025,closure:0,positions:inserts.map((_,i)=>{const rank=order.indexOf(i);return[-.48+rank*.24,rank*.055,.23-rank*.19];}),angles:inserts.map((_,i)=>i===selected?-Math.PI:0),coverZ:.082,rotations:inserts.map((_,i)=>i===selected?-.012:0)};
    return{fold:Math.PI,rootX:.08,rootY:0,rootZ:-.115,closure:1,positions:[[0,0,-.17],[.008,.008,0],[-.008,-.008,.17]],angles:[0,0,0],coverZ:.082,rotations:[.002,-.004,.003]};
  }
  function applyPose(t){
    fold=THREE.MathUtils.lerp(fold,pose.fold,t);wrap.update(fold);
    root.position.x=THREE.MathUtils.lerp(root.position.x,pose.rootX,t);root.position.y=THREE.MathUtils.lerp(root.position.y,pose.rootY,t);root.rotation.z=THREE.MathUtils.lerp(root.rotation.z,pose.rootZ,t);
    closureAmount=THREE.MathUtils.lerp(closureAmount,pose.closure,t);closureMaterial.opacity=closureAmount;closure.visible=closureAmount>.02;
    spineDetails.update(fold);spineDetails.setClosure(closureAmount);
    inserts.forEach((b,i)=>{b.group.position.lerp(new THREE.Vector3(...pose.positions[i]),t);b.group.rotation.z=THREE.MathUtils.lerp(b.group.rotation.z,pose.rotations[i],t);b.turn.rotation.y=THREE.MathUtils.lerp(b.turn.rotation.y,pose.angles[i],t);b.frontCover.position.z=THREE.MathUtils.lerp(b.frontCover.position.z,pose.coverZ,t);});
    retentionAmount=THREE.MathUtils.lerp(retentionAmount,view==='exploded'?0:1,t);retainers.update(fold,retentionAmount);
  }
  function frameCamera(immediate=false){
    if(!pose)return;
    const previous={fold,root:root.position.clone(),rz:root.rotation.z,closure:closureAmount,retention:retentionAmount,books:inserts.map(b=>({p:b.group.position.clone(),r:b.group.rotation.z,a:b.turn.rotation.y,c:b.frontCover.position.z}))};
    applyPose(1);root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root);
    fold=previous.fold;wrap.update(fold,true);root.position.copy(previous.root);root.rotation.z=previous.rz;closureAmount=previous.closure;closureMaterial.opacity=closureAmount;closure.visible=closureAmount>.02;spineDetails.update(fold,true);spineDetails.setClosure(closureAmount);
    inserts.forEach((b,i)=>{const p=previous.books[i];b.group.position.copy(p.p);b.group.rotation.z=p.r;b.turn.rotation.y=p.a;b.frontCover.position.z=p.c;});retentionAmount=previous.retention;retainers.update(fold,retentionAmount);root.updateMatrixWorld(true);
    const direction=(view==='closed'?new THREE.Vector3(3.25,1.5,9.7):new THREE.Vector3(.65,1.65,10)).normalize(),right=new THREE.Vector3(direction.z,0,-direction.x).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize(),center=bounds.getCenter(new THREE.Vector3());
    const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),aspect=width/height;let distance=0;
    for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){const v=new THREE.Vector3(x,y,z).sub(center),d=v.dot(direction);distance=Math.max(distance,Math.abs(v.dot(right))/(tangent*aspect)+d,Math.abs(v.dot(up))/tangent+d);}
    distance*=view==='closed'?(width<500?1.22:1.16):1.12;goalTarget.copy(center);goalCamera.copy(direction).multiplyScalar(distance).add(center);cameraTween=true;
    if(immediate){camera.position.copy(goalCamera);controls.target.copy(goalTarget);controls.update();cameraTween=false;}
  }
  function updatePose(resetCamera=false,immediate=false){pose=makePose();if(resetCamera)frameCamera(immediate);if(immediate)applyPose(1);}
  function setState(next={}){
    state={...state,...next,inserts:next.inserts?next.inserts.map((p,i)=>({...state.inserts[i],...p})):state.inserts};materials.setColor(state.leather);
    inserts.forEach((b,i)=>{const p=state.inserts[i]||{type:'sketch',color:'ivory'};b.pageMat.map=paperMap(p.type,p.color);b.pageMat.needsUpdate=true;b.edgeMat.color.set(PAPER[p.color]||PAPER.ivory);b.lineM.color.set(PAPER[p.color]||PAPER.ivory).multiplyScalar(p.color==='ivory'?.72:1.4);});
    updatePose(view==='open'&&!userMoved,media.matches);
  }
  function setView(next){if(!['closed','open','exploded'].includes(next))return;setDetailVisible(false);view=next;userMoved=false;updatePose(true,media.matches);emit('journal-view',{view});}
  function reset(){detailDismissed=false;userMoved=false;updatePose(true,media.matches);}
  function resize(){const r=container.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(!userMoved)frameCamera(true);}
  function updateDimensions(){
    if(view!=='closed'||Math.abs(fold-Math.PI)>.025){dimensions.update({visible:false});return;}
    root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const project=(s,y)=>{const p=wrap.point(s,y,fold,COVER.thickness/2);const v=new THREE.Vector3(p.x,p.y,p.z).applyMatrix4(root.matrixWorld).project(camera);return{x:(v.x+1)*width/2,y:(1-v.y)*height/2,z:v.z};};
    const frontSpine=COVER.width+SPINE_LENGTH,half=COVER.height/2;
    const center=project((frontSpine+STRIP_LENGTH)/2,0);
    // The rounded spine protrudes beyond the front panel. Measure from its
    // visible outer edge so the height line never lands on the leather.
    let spine=COVER.width;
    for(let j=1;j<=24;j++){const s=COVER.width+SPINE_LENGTH*j/24;if(project(s,0).x<project(spine,0).x)spine=s;}
    const faceNormal=new THREE.Vector3(0,0,1).transformDirection(root.matrixWorld);
    const frontCenter=new THREE.Vector3(0,0,COVER.radius).applyMatrix4(root.matrixWorld);
    const facesCamera=faceNormal.dot(camera.position.clone().sub(frontCenter).normalize())>.2;
    dimensions.update({visible:facesCamera,points:[project(spine,half),project(spine,-half),project(STRIP_LENGTH,-half)],center,width,height});
  }
  const detailHost=document.getElementById('journal-detail');
  const detailRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  detailRenderer.setPixelRatio(Math.min(devicePixelRatio,2));
  detailRenderer.setSize(122,107,false);
  detailRenderer.outputColorSpace=renderer.outputColorSpace;detailRenderer.toneMapping=renderer.toneMapping;detailRenderer.toneMappingExposure=renderer.toneMappingExposure;
  detailRenderer.setClearColor(0xdddcd6,0);detailHost?.append(detailRenderer.domElement);
  detailRenderer.domElement.setAttribute('role','img');detailRenderer.domElement.setAttribute('aria-label','Live front close-up of the three stacked goats engraving. Follows the journal rotation.');
  // Render-target textures belong to their WebGL context. Give the small
  // preview its own environment so the brass retains its reflected light.
  const detailEnvironment=studioEnvironment(detailRenderer,256);
  const detailCamera=new THREE.PerspectiveCamera(31,122/107,.01,100);
  const detailCenter=new THREE.Vector3(),detailDirection=new THREE.Vector3();
  const viewerOrbit=new THREE.Spherical();
  const homeOrbit=new THREE.Spherical().setFromVector3(new THREE.Vector3(3.25,1.5,9.7));
  let detailVisible=false,detailDismissed=false;
  function dismissDetail(){detailDismissed=true;setDetailVisible(false);}
  function setDetailVisible(value){
    if(detailVisible===value)return;
    detailVisible=value;detailHost?.setAttribute('aria-hidden',String(!value));
    emit('journal-detail',{visible:value});
  }
  function renderDetail(){
    // Start on the engraved +Z face, then follow the main orbit with restrained
    // yaw and pitch so the live fitting moves without losing the front mark.
    spineDetails.keeper.getWorldPosition(detailCenter);
    viewerOrbit.setFromVector3(detailDirection.copy(camera.position).sub(controls.target));
    const orbitTurn=viewerOrbit.theta-homeOrbit.theta;
    const yaw=Math.atan2(Math.sin(orbitTurn),1.25+Math.cos(orbitTurn));
    const pitch=THREE.MathUtils.clamp(viewerOrbit.phi-homeOrbit.phi,-.28,.28);
    detailDirection.set(Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).transformDirection(spineDetails.keeper.matrixWorld);
    detailCamera.position.copy(detailCenter).addScaledVector(detailDirection,.48);
    detailCamera.up.set(0,1,0).transformDirection(spineDetails.keeper.matrixWorld);
    detailCamera.lookAt(detailCenter);
    scene.environment=detailEnvironment.texture;
    detailRenderer.render(scene,detailCamera);
    scene.environment=env.texture;
  }
  const onStart=()=>{cameraTween=false;userMoved=true;};controls.addEventListener('start',onStart);
  const onKey=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||![container,renderer.domElement].includes(event.target))return;event.preventDefault();onStart();const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));if(event.key==='ArrowLeft')s.theta-=.13;if(event.key==='ArrowRight')s.theta+=.13;if(event.key==='ArrowUp')s.phi=Math.max(.25,s.phi-.13);if(event.key==='ArrowDown')s.phi=Math.min(Math.PI-.25,s.phi+.13);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();};container.addEventListener('keydown',onKey);
  const onLost=e=>{e.preventDefault();emit('journal-error',new Error('The graphics context was lost. Reload to restore the journal.'));};renderer.domElement.addEventListener('webglcontextlost',onLost);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);const observer=new IntersectionObserver(entries=>{active=entries[0].isIntersecting;},{rootMargin:'150px'});observer.observe(container);
  function animate(time){if(disposed)return;requestId=requestAnimationFrame(animate);if(!active||time-lastTime<22)return;const delta=Math.min((time-lastTime)/1000||.024,.08);lastTime=time;const t=media.matches?1:1-Math.exp(-delta*7.5);applyPose(t);if(cameraTween){camera.position.lerp(goalCamera,t);controls.target.lerp(goalTarget,t);if(camera.position.distanceTo(goalCamera)<.002)cameraTween=false;}controls.update();updateDimensions();renderer.render(scene,camera);
    const showDetail=!detailDismissed&&view==='closed'&&Math.abs(fold-Math.PI)<.025;
    if(showDetail)renderDetail();
    setDetailVisible(showDetail);
  }
  setState(initialState);resize();updatePose(true,true);updateDimensions();renderer.render(scene,camera);requestId=requestAnimationFrame(animate);queueMicrotask(()=>emit('journal-ready',{view,renderer:'three.js'}));
  return{setState,setView,reset,dismissDetail,capture(){renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');},dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(requestId);resizeObserver.disconnect();observer.disconnect();setDetailVisible(false);detailEnvironment.dispose();detailRenderer.dispose();detailRenderer.domElement.remove();container.removeEventListener('keydown',onKey);renderer.domElement.removeEventListener('webglcontextlost',onLost);controls.dispose();dimensions.dispose();const geometries=new Set(),otherMaterials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>otherMaterials.add(m));});geometries.forEach(g=>g.dispose());otherMaterials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());materials.dispose();env.dispose();renderer.dispose();renderer.domElement.remove();}};
}
