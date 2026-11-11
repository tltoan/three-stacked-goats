import { startJournal } from './journal-pages/pages.js?v=7';

// Let visitors see the landing: wait until the logo intro has revealed the homepage.
let started=false;
const root=document.documentElement;
const introObserver=new MutationObserver(startWhenVisible);
function startWhenVisible(){
  if(started||document.hidden||root.classList.contains('intro-pending'))return;
  started=true;
  introObserver.disconnect();
  document.removeEventListener('visibilitychange',startWhenVisible);
  startJournal();
}
introObserver.observe(root,{attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',startWhenVisible);
window.addEventListener('pagehide',()=>introObserver.disconnect(),{once:true});
startWhenVisible();
