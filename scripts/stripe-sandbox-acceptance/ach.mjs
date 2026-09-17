// Real hosted Stripe test ACH; no browser traces, credentials or capability logs.
import {chromium} from 'playwright';
const scenario=process.argv[2]??'success';if(!['success','failure'].includes(scenario))throw new Error('ach_scenario_invalid');
const response=await fetch('http://127.0.0.1:8799/checkout',{method:'POST'}),session=await response.json();
if(session.result!=='checkout_created'){console.log(JSON.stringify({result:'checkout_unavailable'}));process.exit(1);}
const url=new URL(session.checkoutUrl);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||!url.pathname.includes('/cs_test_'))throw new Error('test_checkout_required');
const browser=await chromium.launch({headless:true});let stage='open';
try {
 const page=await browser.newPage();page.setDefaultTimeout(15000);
 await page.goto(session.checkoutUrl,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(5000);
 await page.locator('#email').fill('stripe-ach-acceptance@example.invalid');
 stage='select_bank';await page.locator('#payment-method-accordion-item-title-us_bank_account').click({force:true});await page.waitForTimeout(1500);
 await page.locator('#billingName').fill('Synthetic ACH Test');
 stage='test_bank';await page.getByRole('button',{name:'Test (Non-OAuth)',exact:true}).click({force:true});await page.waitForTimeout(3000);
 const clickFrameButton=async (name,timeout=45000)=>{
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){for(const frame of page.frames()){const button=['Success','Failure','Not now','Done'].includes(name)?frame.getByText(name,{exact:true}):frame.getByRole('button',{name,exact:true});if(await button.count()&&await button.first().isVisible()){await button.first().click({force:true});return;}}await page.waitForTimeout(1000);}
  const allowed=['Agree and continue','Continue','Success','Failure','Connect account','Done','Pay','Close'];
  const visible=[];for(const frame of page.frames()){for(const label of allowed){const button=frame.getByRole('button',{name:label,exact:true});if(await button.count()&&await button.first().isVisible())visible.push(label);}}
  console.log(JSON.stringify({result:'expected_control_missing',stage,visible}));throw new Error('test_control_not_found');
 };
 stage='test_bank_consent';await clickFrameButton('Agree and continue');
 stage='select_test_account';await clickFrameButton(scenario==='success'?'Success':'Failure');
 stage='connect_test_account';await clickFrameButton('Connect account');
 stage='finish_bank_link';await clickFrameButton('Finish without saving');
 stage='return_from_bank';
 let returned=false;const returnDeadline=Date.now()+45000;
 while(Date.now()<returnDeadline&&!returned){for(const frame of page.frames()){const button=frame.getByRole('button',{name:/^Continue to Elysia Ecobotics Online Staging$/});if(await button.count()&&await button.first().isVisible()){await button.first().click({force:true});returned=true;break;}}await page.waitForTimeout(1000);}
 if(!returned)throw new Error('bank_return_control_missing');
 await page.waitForTimeout(2000);
 stage='pay';await page.locator('button[type=submit]').click({force:true});
 await page.waitForTimeout(12000);
 const state=await page.evaluate(()=>({pending:/processing|pending|business days|verify your bank/i.test(document.body.innerText),needsAccount:/connect.*bank|select.*account/i.test(document.body.innerText),needsAddress:/address.*required|postal.*required/i.test(document.body.innerText),buttons:[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(x=>['Pay','Connect account','Done','Continue','Verify account','Agree and continue'].includes(x)),invalidFields:[...document.querySelectorAll('input:invalid')].map(e=>e.id).filter(x=>/^[a-zA-Z0-9_-]{1,60}$/.test(x)),failed:/payment failed|payment was declined|could not process/i.test(document.body.innerText)}));
 console.log(JSON.stringify({result:'ach_submitted',scenario,...state,providerTruth:'must_verify_database'}));
}catch{console.log(JSON.stringify({result:'ach_browser_failed',stage}));process.exitCode=1;}finally{await browser.close();}
