// Capability URL and authentication remain in memory. Synthetic account only.
import {chromium} from 'playwright';
const response=await fetch('http://127.0.0.1:8799/portal',{method:'POST'}),session=await response.json();
if(session.result!=='portal_created'){console.log(JSON.stringify(session));process.exitCode=1;}
else {
 const url=new URL(session.portalUrl);if(url.protocol!=='https:'||url.hostname!=='billing.stripe.com')throw new Error('portal_origin_invalid');
 const browser=await chromium.launch({headless:true});let stage='open';
 try {
  const page=await browser.newPage();page.setDefaultTimeout(15000);
  await page.goto(session.portalUrl,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(4000);
  const cancellation=page.getByText('Cancel subscription',{exact:true});
  console.log(JSON.stringify({result:'portal_opened',cancelActionPresent:await cancellation.count()>0}));
  if(await cancellation.count()){
   stage='cancel';await cancellation.first().click();await page.waitForTimeout(1500);
   const confirm=page.getByRole('button',{name:'Cancel subscription',exact:true});
   if(await confirm.count())await confirm.last().click();
   await page.waitForTimeout(5000);
   console.log(JSON.stringify({result:'portal_cancellation_requested',providerTruth:'must_verify_database'}));
  }
 }catch{console.log(JSON.stringify({result:'portal_browser_failed',stage}));process.exitCode=1;}
 finally{await browser.close();}
}
