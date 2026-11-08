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
  return compact?{x:2,z:slot*5.9}:{x:2+(slot-1)*8.65,z:0};
}
