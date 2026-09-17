// Non-secret references only. Run after the owner creates the Access apps.
// This command never sets qualification flags, deploys, or reads credentials.
import {readFile,writeFile} from 'node:fs/promises';
const team=process.argv.find(value=>value.startsWith('--team-domain='))?.split('=',2)[1];
const audience=process.argv.find(value=>value.startsWith('--audience='))?.split('=',2)[1];
if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team??'')||!/^[a-f0-9]{64}$/.test(audience??''))throw new Error('Exact non-secret Cloudflare Access team origin and application AUD are required.');
const candidates=[];
for(const file of ['wrangler.ui.sandbox.jsonc','wrangler.billing.sandbox.jsonc']){
 const text=await readFile(file,'utf8');const config=JSON.parse(text.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n'));
 if(!config.name.endsWith('-sandbox')||config.vars.SUPABASE_URL!=='https://kdtqyxlrkpmlpupzgmwv.supabase.co')throw new Error('Sandbox configuration identity mismatch.');
 if(file.includes('billing')&&(config.vars.BILLING_MODE!=='disabled'||Object.entries(config.vars).some(([k,v])=>(k.endsWith('_ENABLED')||k.endsWith('_CONFIRMED'))&&v!=='false')))throw new Error('All billing gates must remain OFF.');
 candidates.push([file,text.replace(/("SANDBOX_ACCESS_TEAM_DOMAIN"\s*:\s*)"[^"]*"/,'$1'+JSON.stringify(team)).replace(/("SANDBOX_ACCESS_AUDIENCE"\s*:\s*)"[^"]*"/,'$1'+JSON.stringify(audience))]);
}
for(const [file,text] of candidates)await writeFile(file,text);
console.log('Updated non-secret sandbox Access references. Billing gates unchanged; commit, deploy both sandbox Workers and verify authentication before qualification.');
