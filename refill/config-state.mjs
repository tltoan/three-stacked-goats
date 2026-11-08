export const PAPER_TYPES={
  blank:{label:'Blank',description:'Open space for sketches, loose thoughts, and whatever comes next.'},
  lined:{label:'Lined',description:'A little rhythm for daily entries, notes, and longer stories.'},
  dotted:{label:'Dotted',description:'Quiet structure for lists, plans, and ideas taking shape.'},
};
export const PACK_PRICE=10;
export const STORAGE_KEY='3sg-refill-pack-v1';
export const freshPack=()=>({books:['blank','lined','dotted']});
export function validPack(raw){
  const state=freshPack();
  for(let i=0;i<3;i++)if(Object.hasOwn(PAPER_TYPES,raw?.books?.[i]))state.books[i]=raw.books[i];
  return state;
}
export function setPaper(state,index,type){
  if(!Number.isInteger(index)||index<0||index>2||!Object.hasOwn(PAPER_TYPES,type))return validPack(state);
  const next=validPack(state);next.books[index]=type;return next;
}
export function packText(state){
  const pack=validPack(state);
  return ['THREE STACKED GOATS','Your three-booklet refill pack',`Pack price: $${PACK_PRICE}`,'',...pack.books.map((type,i)=>`Book ${i+1}: ${PAPER_TYPES[type].label} / ivory paper`),'','Booklet size: 5 inches tall × 4 inches wide.','Flexible kraft covers · charcoal cotton tie','This saved selection is not an order.'].join('\n');
}
