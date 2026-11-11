export const PAPER_TYPES={
  blank:{label:'Blank',description:'Open space for sketches, loose thoughts, and whatever comes next.'},
  lined:{label:'Lined',description:'A little rhythm for daily entries, notes, and longer stories.'},
  dotted:{label:'Dotted',description:'Quiet structure for lists, plans, and ideas taking shape.'},
};
export const PAPER_COLORS={
  ivory:{label:'Ivory',hex:'#eeeadd'},
  blue:{label:'Blue',hex:'#274abb'},
  black:{label:'Black',hex:'#242424'},
};
export const PACK_PRICE=10;
export const STORAGE_KEY='3sg-refill-pack-v1';
export const freshPack=()=>({books:['blank','lined','dotted'],colors:['ivory','ivory','ivory']});
export function validPack(raw){
  const state=freshPack();
  // Older saved packs contain only paper types; their pages remain ivory.
  for(let i=0;i<3;i++){
    if(Object.hasOwn(PAPER_TYPES,raw?.books?.[i]))state.books[i]=raw.books[i];
    if(Object.hasOwn(PAPER_COLORS,raw?.colors?.[i]))state.colors[i]=raw.colors[i];
  }
  return state;
}
export function setPaper(state,index,type){
  if(!Number.isInteger(index)||index<0||index>2||!Object.hasOwn(PAPER_TYPES,type))return validPack(state);
  const next=validPack(state);next.books[index]=type;return next;
}
export function setColor(state,index,color){
  if(!Number.isInteger(index)||index<0||index>2||!Object.hasOwn(PAPER_COLORS,color))return validPack(state);
  const next=validPack(state);next.colors[index]=color;return next;
}
export function packText(state){
  const pack=validPack(state);
  return ['THREE STACKED GOATS','Your three-booklet refill pack',`Pack price: $${PACK_PRICE}`,'',...pack.books.map((type,i)=>`Book ${i+1}: ${PAPER_TYPES[type].label} / ${PAPER_COLORS[pack.colors[i]].label.toLowerCase()} paper`),'','Booklet size: 5 inches tall × 4 inches wide.','Flexible kraft covers · charcoal cotton tie','This saved selection is not an order.'].join('\n');
}
