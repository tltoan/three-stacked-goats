import * as THREE from 'three';

// t identifies a piece of cotton, not a fraction of the currently visible
// shape. This keeps the plies and fuzz travelling with the pulled material.
class MaterialCurve extends THREE.Curve {
  constructor(points){super();this.points=points;}
  getPoint(t,target=new THREE.Vector3()){
    const n=this.points.length-1,u=Math.min(n-1,Math.floor(t*n)),f=t*n-u;
    const p0=this.points[Math.max(0,u-1)],p1=this.points[u],p2=this.points[u+1],p3=this.points[Math.min(n,u+2)];
    const f2=f*f,f3=f2*f;
    for(const axis of ['x','y','z'])target[axis]=.5*((2*p1[axis])+(-p0[axis]+p2[axis])*f+(2*p0[axis]-5*p1[axis]+4*p2[axis]-p3[axis])*f2+(-p0[axis]+3*p1[axis]-3*p2[axis]+p3[axis])*f3);
    return target;
  }
  getPointAt(t,target){return this.getPoint(t,target);}
  getTangentAt(t,target){return this.getTangent(t,target);}
}

export async function loadCordMotion(){
  const [meta,data]=await Promise.all([
    fetch(new URL('./assets/cord-motion.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Cord motion metadata unavailable');return r.json();}),
    fetch(new URL('./assets/cord-motion.bin',import.meta.url)).then(r=>{if(!r.ok)throw Error('Cord motion unavailable');return r.arrayBuffer();}),
  ]);
  const poses=new Float32Array(data);
  if(poses.length!==meta.frames*meta.points*3)throw Error('Incomplete cord motion');
  const points=Array.from({length:meta.points},(_,i)=>new THREE.Vector3().fromArray(poses,i*3));
  const curve=new MaterialCurve(points),resolution=768;
  let skin=[],lastTime=-1;
  function bind(parts){
    const frames=curve.computeFrenetFrames(resolution,false),centers=curve.getSpacedPoints(resolution);
    const v=new THREE.Vector3(),normal=new THREE.Vector3();
    skin=parts.map(({object,geometry,parameters})=>{
      const position=geometry.attributes.position,normals=geometry.attributes.normal;
      const local=new Float32Array(position.count*3),localNormal=normals?new Float32Array(position.count*3):null,indices=new Uint16Array(position.count);
      for(let i=0;i<position.count;i++){
        const j=Math.min(resolution,Math.round(parameters[i]*resolution));indices[i]=j;
        v.fromBufferAttribute(position,i).sub(centers[j]);
        local[i*3]=v.dot(frames.normals[j]);local[i*3+1]=v.dot(frames.binormals[j]);local[i*3+2]=v.dot(frames.tangents[j]);
        if(normals){normal.fromBufferAttribute(normals,i);localNormal[i*3]=normal.dot(frames.normals[j]);localNormal[i*3+1]=normal.dot(frames.binormals[j]);localNormal[i*3+2]=normal.dot(frames.tangents[j]);}
      }
      position.setUsage(THREE.DynamicDrawUsage);if(normals)normals.setUsage(THREE.DynamicDrawUsage);
      // Bounds of the initial tied pose must not cull the moving cord.
      object.frustumCulled=false;
      return {position,normals,local,localNormal,indices};
    });
  }
  function update(seconds){
    const time=Math.max(0,Math.min(meta.duration,seconds));if(time===lastTime)return;lastTime=time;
    const frame=time*meta.fps,a=Math.floor(frame),b=Math.min(meta.frames-1,a+1),mix=frame-a,stride=meta.points*3;
    for(let i=0;i<meta.points;i++)for(let axis=0;axis<3;axis++)points[i].setComponent(axis,THREE.MathUtils.lerp(poses[a*stride+i*3+axis],poses[b*stride+i*3+axis],mix));
    const frames=curve.computeFrenetFrames(resolution,false),centers=curve.getSpacedPoints(resolution);
    for(const {position,normals,local,localNormal,indices} of skin){
      const p=position.array,n=normals?.array;
      for(let i=0;i<position.count;i++){
        const j=indices[i],offset=i*3,c=centers[j],u=frames.normals[j],v=frames.binormals[j],w=frames.tangents[j];
        const x=local[offset],y=local[offset+1],z=local[offset+2];
        p[offset]=c.x+u.x*x+v.x*y+w.x*z;p[offset+1]=c.y+u.y*x+v.y*y+w.y*z;p[offset+2]=c.z+u.z*x+v.z*y+w.z*z;
        if(n){const nx=localNormal[offset],ny=localNormal[offset+1],nz=localNormal[offset+2];n[offset]=u.x*nx+v.x*ny+w.x*nz;n[offset+1]=u.y*nx+v.y*ny+w.y*nz;n[offset+2]=u.z*nx+v.z*ny+w.z*nz;}
      }
      position.needsUpdate=true;if(normals)normals.needsUpdate=true;
    }
  }
  return {curve,bind,update};
}
