// Preserve the existing rope simulation, then unfold the separated booklets.
export const TIMELINE_SECONDS=8;
export const UNPACK_SECONDS=4.6;
const clamp=value=>Math.max(0,Math.min(1,value));
export function ramp(value,start,end){
  const t=clamp((value-start)/(end-start));
  return t*t*(3-2*t);
}
export function unpackMotion(progress){
  const p=clamp(progress),untie=clamp(p/.82);
  return{
    cordTime:untie*TIMELINE_SECONDS,
    bookProgress:[ramp(untie,.88,1),ramp(untie,.84,.99),ramp(untie,.72,.89)],
    openProgress:[ramp(p,.83,1),ramp(p,.82,.98),ramp(p,.74,.94)],
    settle:ramp(untie,.65,.71),
    camera:ramp(untie,.29,.90),
    pageCamera:ramp(p,.67,1),
    phase:p===0?'tied':p===1?'open':p>=.82?'opening':untie<.2625?'loosening':untie<.59?'unwrapping':untie<.72?'setting-tie-down':'laying-out',
  };
}
// Coordinates locate the centre of the right page; the open spread is centred
// two inches to its left. Portrait screens arrange books from top to bottom.
export function bookletLayout(slot,compact){
  return compact?{x:2,z:slot*9}:{x:2+(slot-1)*12,z:0};
}
// A small rise beside the binding, returning to the desk at the outer edge.
// Both ends stay fixed so the same leaves can bend without leaving the spine.
export function pageArch(distance,width=4,z=0){
  const d=Math.max(0,Math.min(width,distance));
  return .16*(d/.42)*Math.exp(1-d/.42)*(1-ramp(d,width-.4,width))*(.94+.06*Math.cos(z*Math.PI/5));
}
// Exact critically damped motion: starts gently and keeps its velocity when a
// customer selects another book during the glide. Units are inches/seconds.
export function slideStep(position,velocity,target,seconds,frequency=7.5){
  const offset=position-target,carry=velocity+frequency*offset,decay=Math.exp(-frequency*seconds);
  return {position:target+(offset+carry*seconds)*decay,velocity:(velocity-frequency*carry*seconds)*decay};
}
