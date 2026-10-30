const {chromium}=require('playwright');const SC=+(process.env.SCALE||1);(async()=>{
for(const [f,o,t,w,h] of [['scrollbg.html','scrollbg.png',false,1080,1920],['bezel.html','bezel.png',true,1080,1920],['mask.html','mask.png',false,780,1386]]){
 // fresh browser per image + retries: large (4K) captures occasionally fail under memory pressure
 for(let i=1;;i++){const b=await chromium.launch();try{const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:SC});await p.goto('file://'+__dirname+'/'+f);await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:__dirname+'/'+o,omitBackground:t});console.log(o);break}catch(e){if(i>=4)throw e;console.log('retry',o)}finally{await b.close()}}}
})();
