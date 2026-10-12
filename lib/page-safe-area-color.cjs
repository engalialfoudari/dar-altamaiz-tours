// Literal browser script shared by hosted pages and native WebViews.
const PAGE_SAFE_AREA_COLOR_JS = String.raw`
(function(){
  if(window.__dtSafeAreaColorBridge)return;
  window.__dtSafeAreaColorBridge=true;
  var lastColor='',pending=false;
  function report(){
    pending=false;
    if(!document.body)return;
    var inset=parseFloat(getComputedStyle(document.body).paddingTop)||0;
    var element=document.elementFromPoint(1,Math.min(inset+1,window.innerHeight-1));
    var color='';
    while(element){
      var value=getComputedStyle(element).backgroundColor;
      var match=/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(value);
      if(match&&(!match[4]||Number(match[4])===1)){
        color='#'+[match[1],match[2],match[3]].map(function(channel){
          return ('0'+Number(channel).toString(16)).slice(-2);
        }).join('');
        break;
      }
      element=element.parentElement;
    }
    if(!color||color===lastColor)return;
    lastColor=color;
    document.documentElement.style.setProperty('--hotel-safe-color',color);
    var message=JSON.stringify({type:'dt-page-safe-area-color',color:color});
    if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);
    if(window.parent!==window)window.parent.postMessage(message,'*');
  }
  function schedule(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(report);
  }
  function start(){
    schedule();
    new MutationObserver(schedule).observe(document.body,{
      subtree:true,childList:true,attributes:true,
      attributeFilter:['class','style','hidden']
    });
    window.addEventListener('scroll',schedule,{passive:true,capture:true});
    window.addEventListener('resize',schedule);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
`;

module.exports = { PAGE_SAFE_AREA_COLOR_JS };
