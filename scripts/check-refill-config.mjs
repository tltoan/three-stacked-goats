import assert from 'node:assert/strict';
import {freshPack,validPack,setPaper,packText,PACK_PRICE} from '../refill/config-state.mjs';

// Exercise every combination, including three copies of the same paper type.
for(const a of ['blank','lined','dotted'])for(const b of ['blank','lined','dotted'])for(const c of ['blank','lined','dotted']){
  let state=freshPack();
  for(const [index,type] of [a,b,c].entries()){
    const before=structuredClone(state),next=setPaper(state,index,type);
    assert.deepEqual(state,before,'Changing a book mutated the previous pack');
    for(let other=0;other<3;other++)if(other!==index)assert.equal(next.books[other],before.books[other],'One booklet changed another booklet');
    state=next;
  }
  assert.deepEqual(state.books,[a,b,c]);
  assert.deepEqual(validPack(JSON.parse(JSON.stringify(state))),state,'Saved selections did not round-trip');
}
assert.deepEqual(validPack({books:['unknown','dotted',null,'lined']}),{books:['blank','dotted','dotted']});
assert.deepEqual(validPack(null),freshPack());
assert.deepEqual(setPaper(freshPack(),3,'lined'),freshPack());
assert.deepEqual(setPaper(freshPack(),1,'__proto__'),freshPack());
assert.equal(PACK_PRICE,10);
const text=packText({books:['dotted','blank','lined']});
assert(text.includes('Book 1: Dotted / ivory paper\nBook 2: Blank / ivory paper\nBook 3: Lined / ivory paper'));
assert(text.includes('Pack price: $10'));
console.log('All 27 refill combinations preserve independent choices, storage, and summary order.');
