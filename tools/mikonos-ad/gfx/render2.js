const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
for(const [f,o,t,w,h] of [['scrollbg.html','scrollbg.png',false,1080,1920],['bezel.html','bezel.png',true,1080,1920],['mask.html','mask.png',false,780,1386]]){const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('file://'+__dirname+'/'+f);await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:__dirname+'/'+o,omitBackground:t});await p.close();console.log(o)}
await b.close()})();
