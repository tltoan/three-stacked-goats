import assert from 'node:assert/strict';
import {unpackMotion,bookletLayout,pageArch,UNPACK_SECONDS} from '../refill/motion.mjs';

assert(UNPACK_SECONDS<5,'The opening sequence should stay quick');
assert.deepEqual(unpackMotion(0).openProgress,[0,0,0]);
assert.deepEqual(unpackMotion(1).openProgress,[1,1,1]);
assert.equal(unpackMotion(0).phase,'tied');
assert.equal(unpackMotion(1).phase,'open');
let previous=unpackMotion(0);
for(let frame=1;frame<=460;frame++){
  const motion=unpackMotion(frame/460);
  for(let book=0;book<3;book++){
    const open=motion.openProgress[book];
    assert(open>=0&&open<=1);
    assert(open>=previous.openProgress[book],'Opening should never snap backwards');
    assert(open-previous.openProgress[book]<.03,'Opening should remain continuous');
    if(open>0){
      assert.equal(motion.bookProgress[book],1,'A book opened before reaching its own space');
      assert(motion.cordTime>=6,'A book opened before the tie cleared');
    }
  }
  previous=motion;
}
for(const compact of [false,true]){
  const positions=[0,1,2].map(slot=>bookletLayout(slot,compact));
  for(let i=1;i<3;i++)assert(compact?positions[i].z-positions[i-1].z>5:positions[i].x-positions[i-1].x>8,'Open spreads overlap');
}
for(const z of [-2.5,0,2.5]){
  assert.equal(pageArch(0,4,z),0,'The leaf must stay attached to its spine');
  assert.equal(pageArch(4,4,z),0,'The outer edge should settle back down');
  assert(pageArch(.42,4,z)>.14,'The arch should be visible beside the binding');
  assert(pageArch(2,4,z)<.02,'The arch should relax across the rest of the page');
  let height=0;
  for(let step=1;step<=400;step++){
    const next=pageArch(step/100,4,z);
    assert(next>=0&&next<=.161,'The page curl should stay subtle and above the base plane');
    assert(Math.abs(next-height)<.012,'The surface should bend continuously');height=next;
  }
}
console.log('Opening stays continuous after the tie clears; spread spacing and spine-attached page curves pass.');
