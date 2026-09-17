import {readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.cwd();
const jsonc=async file=>JSON.parse((await readFile(file,'utf8')).split('\n').filter(line=>!line.trim().startsWith('//')).join('\n'));
const ui=await jsonc('wrangler.ui.sandbox.jsonc'),billing=await jsonc('wrangler.billing.sandbox.jsonc'),identity=await jsonc('wrangler.identity.sandbox.jsonc');
const database='https://kdtqyxlrkpmlpupzgmwv.supabase.co',origin='https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev';
if(ui.name!=='elysia-ecobotics-online-sandbox'||ui.vars.SANDBOX_UI_ORIGIN!==origin||billing.vars.BILLING_PUBLIC_ORIGIN!==origin
 ||[ui,billing,identity].some(config=>config.vars.SUPABASE_URL!==database)
 ||billing.vars.BILLING_MODE!=='disabled'||Object.entries(billing.vars).some(([k,v])=>(k.endsWith('_ENABLED')||k.endsWith('_CONFIRMED'))&&v!=='false')
 ||ui.assets.run_worker_first!==true||ui.preview_urls!==false
 ||ui.services.some(binding=>!binding.service.endsWith('-sandbox'))||identity.workers_dev!==false)throw new Error('Sandbox isolation or closed gate contract invalid.');
// Deliberate allowlist, not a spread of process.env: no production VITE values,
// provider secrets, or local .env files can enter this separate artifact.
const environment=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
Object.assign(environment,{ELYSIA_ISOLATED_TEST:'1',VITE_ELYSIA_ENVIRONMENT:'sandbox',VITE_SUPABASE_URL:database,VITE_SUPABASE_ANON_KEY:billing.vars.SUPABASE_PUBLISHABLE_KEY,VITE_AUTH_CAPTCHA_MODE:'off'});
const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','vite.config.ts','--mode','sandbox','--outDir','dist-sandbox','--emptyOutDir'],{cwd:root,env:environment,stdio:'inherit'});
if(build.status!==0)process.exit(build.status??1);
for(const file of ['_redirects','_headers','_routes.json','sitemap.xml'])await rm(path.join('dist-sandbox',file),{force:true});
await writeFile('dist-sandbox/robots.txt','User-agent: *\nDisallow: /\n');
const html=await readFile('dist-sandbox/index.html','utf8');
if(!html.includes('name="elysia-billing-api-publication" content="disabled"'))throw new Error('Sandbox browser billing publication is not disabled.');
await writeFile('dist-sandbox/index.html',html.replace('<head>','<head>\n    <meta name="robots" content="noindex,nofollow,noarchive" />').replace('<title>Elysia Ecobotics</title>','<title>Elysia Ecobotics Sandbox</title>'));
const files=[];let sandboxReferenceFound=false;
async function scan(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);if(entry.isDirectory()){await scan(file);continue;}
  const bytes=await readFile(file);
  if(/\.(js|html|css|json|txt)$/.test(file)){
   const text=bytes.toString();
   if(text.includes('qwmcstyfegvpzjmjrylc')||/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|sb_secret_[A-Za-z0-9_-]{16,}/.test(text))throw new Error('Sandbox asset isolation scan failed.');
   if(text.includes(database))sandboxReferenceFound=true;
  }
  files.push({file:path.relative('dist-sandbox',file),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
 }
}
await scan('dist-sandbox');if(!sandboxReferenceFound)throw new Error('Sandbox Supabase binding is absent from browser artifact.');
await writeFile('dist-sandbox-build.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),origin,database,billingPublication:'disabled',productionEnvironmentInherited:false,files},null,2)+'\n');
console.log('Sandbox artifact verified: isolated Supabase only, no inherited environment/secrets, billing disabled.');
