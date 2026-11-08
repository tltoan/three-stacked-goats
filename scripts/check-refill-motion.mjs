import assert from 'node:assert/strict';
import {unpackMotion,bookletLayout,UNPACK_SECONDS} from '../refill/motion.mjs';

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
console.log('Opening starts after the tie clears and each book is separated; all spreads fit without overlap.');
