const {chromium}=require('playwright');const SC=+(process.env.SCALE||1);(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:SC});
for(const [f,o,t] of [['endcard.html','endcard.png',false],['bug.html','bug.png',true]]){try{await p.goto('file://'+__dirname+'/'+f);await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:__dirname+'/'+o,omitBackground:t});console.log('rendered',o)}catch(e){console.log('skip',f,e.message.split('\n')[0])}}
await b.close()})();
