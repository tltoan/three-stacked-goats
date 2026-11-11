import assert from 'node:assert/strict';
import {slideStep} from '../refill/motion.mjs';

function travel(fps,target=12,seconds=2){
  let state={position:0,velocity:0},previous=0;
  for(let i=0;i<fps*seconds;i++){
    state=slideStep(state.position,state.velocity,target,1/fps);
    assert(state.position>=previous&&state.position<=target,'A resting camera should glide without overshooting');
    previous=state.position;
  }
  return state;
}
const slow=travel(30),fast=travel(120);
assert(Math.abs(slow.position-fast.position)<1e-10,'Camera speed must not depend on frame rate');
assert(Math.abs(slow.velocity-fast.velocity)<1e-10);
assert(Math.abs(fast.position-12)<.002&&Math.abs(fast.velocity)<.01,'The camera should settle onto the chosen book');
assert(slideStep(0,0,12,1/60).position<.1,'The camera should accelerate from rest rather than jump on selection');

let state=slideStep(0,0,24,.22);
const before={...state};
const retargeted=slideStep(state.position,state.velocity,-12,0);
assert(Math.abs(retargeted.position-state.position)<1e-10&&Math.abs(retargeted.velocity-state.velocity)<1e-10,'Retargeting must preserve the current position and velocity');
state=slideStep(state.position,state.velocity,-12,1/120);
assert(Math.abs(state.position-before.position)<.6,'A rapid selection should continue from the current pose');
for(let i=0;i<240;i++)state=slideStep(state.position,state.velocity,-12,1/120);
assert(Math.abs(state.position+12)<.002,'An interrupted slide should settle on the latest selection');

// Translating camera and look-at target together keeps the view angle and zoom.
for(const offset of [0,8,24]){
  const a=slideStep(3,2,15,.1),b=slideStep(3+offset,2,15+offset,.1);
  assert(Math.abs((b.position-a.position)-offset)<1e-10);
}
console.log('Camera glides ease from rest, preserve momentum on retargeting, keep a steady view, and agree at 30/120 fps.');
