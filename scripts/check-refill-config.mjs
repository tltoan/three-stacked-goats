import assert from 'node:assert/strict';
import {freshPack,validPack,setPaper,setColor,packText,PAPER_COLORS,PACK_PRICE} from '../refill/config-state.mjs';

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
  for(const ca of Object.keys(PAPER_COLORS))for(const cb of Object.keys(PAPER_COLORS))for(const cc of Object.keys(PAPER_COLORS)){
    let colored=state;
    for(const [index,color] of [ca,cb,cc].entries()){
      const before=structuredClone(colored),next=setColor(colored,index,color);
      assert.deepEqual(colored,before,'Changing a color mutated the previous pack');
      assert.deepEqual(next.books,before.books,'Changing color altered the paper types');
      for(let other=0;other<3;other++)if(other!==index)assert.equal(next.colors[other],before.colors[other],'One color changed another booklet');
      colored=next;
    }
    assert.deepEqual(colored.colors,[ca,cb,cc]);
    assert.deepEqual(validPack(JSON.parse(JSON.stringify(colored))),colored,'Saved colors did not round-trip');
    assert.deepEqual(setPaper(colored,1,'blank').colors,colored.colors,'Changing paper type reset colors');
    const text=packText(colored);
    for(let i=0;i<3;i++)assert(text.includes(`Book ${i+1}: ${[a,b,c][i][0].toUpperCase()+[a,b,c][i].slice(1)} / ${[ca,cb,cc][i]} paper`),'Export lost a booklet choice');
  }
}
assert.deepEqual(validPack({books:['unknown','dotted',null,'lined']}),{books:['blank','dotted','dotted'],colors:['ivory','ivory','ivory']});
assert.deepEqual(validPack({books:['lined','blank','dotted']}),{books:['lined','blank','dotted'],colors:['ivory','ivory','ivory']},'Legacy packs should keep types with ivory pages');
assert.deepEqual(validPack({colors:['blue','__proto__','invalid','black']}).colors,['blue','ivory','ivory']);
assert.deepEqual(validPack(null),freshPack());
assert.deepEqual(setPaper(freshPack(),3,'lined'),freshPack());
assert.deepEqual(setPaper(freshPack(),1,'__proto__'),freshPack());
assert.deepEqual(setColor(freshPack(),-1,'blue'),freshPack());
assert.deepEqual(setColor(freshPack(),1,'__proto__'),freshPack());
assert.equal(PACK_PRICE,10);
const text=packText({books:['dotted','blank','lined']});
assert(text.includes('Book 1: Dotted / ivory paper\nBook 2: Blank / ivory paper\nBook 3: Lined / ivory paper'));
assert(text.includes('Pack price: $10'));
console.log('All 729 refill type/color combinations preserve independent choices, storage, and exports. Legacy ivory packs migrate correctly.');
