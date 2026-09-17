// Real Stripe TEST Checkout only. No tracing, screenshots, URLs or body logging.
import {chromium} from 'playwright';
const scenario=process.argv[2]??'success';
if(!['success','decline','recurring','dispute','job'].includes(scenario))throw new Error('scenario_invalid');
const response=await fetch('http://127.0.0.1:8799/'+(['recurring','job'].includes(scenario)?scenario:'checkout'),{method:'POST'});
const session=await response.json();
if(session.result!=='checkout_created') { console.log(JSON.stringify(session)); process.exitCode=1; }
else {
 const url=new URL(session.checkoutUrl);
 if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||!url.pathname.includes('/cs_test_'))throw new Error('checkout_test_origin_required');
 const browser=await chromium.launch({headless:true});
 let stage='navigation';
 try {
  const page=await browser.newPage();page.setDefaultTimeout(20000);
  const failures=[];page.on('response',r=>{if(r.status()>=400)failures.push({status:r.status(),host:new URL(r.url()).hostname});});
  page.on('requestfailed',r=>failures.push({status:0,host:new URL(r.url()).hostname}));
  await page.goto(session.checkoutUrl,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(6000);
  stage='email';
  if(await page.locator('#email').count())await page.locator('#email').fill('stripe-acceptance@example.invalid');
  stage='card_selection';
  const card=page.locator('#payment-method-accordion-item-title-card');
  if(await card.count())await card.click({force:true});
  stage='card_details';
  if(scenario!=='job'||await page.locator('#cardNumber').count()){
  await page.locator('#cardNumber').fill(scenario==='decline'?'4000000000000002':scenario==='dispute'?'4000000000000259':'4242424242424242');
  await page.locator('#cardExpiry').fill('1234');
  await page.locator('#cardCvc').fill('123');
  await page.locator('#billingName').fill('Synthetic Sandbox Test');
  await page.locator('#billingCountry').selectOption('US');
  await page.waitForTimeout(1000);
  if(await page.locator('#billingPostalCode').count())await page.locator('#billingPostalCode').fill('94107');
  }
  stage='submit';
  await page.locator('button[type=submit]').click({force:true});
  await page.waitForTimeout(20000);
  const state=await page.evaluate(()=>({declined:/card was declined|card has been declined/i.test(document.body.innerText),challenge:/verify you are human|complete the captcha|security check/i.test(document.body.innerText),invalid:/invalid card|invalid email|incomplete|is required/i.test(document.body.innerText),captchaFrame:[...document.querySelectorAll('iframe')].some(f=>/hcaptcha|captcha/i.test(f.title)&&f.getBoundingClientRect().height>100)}));
  const returnOrigin=new URL(page.url()).origin==='https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev';
  console.log(JSON.stringify({result:'checkout_submitted',scenario,returnedToSandbox:returnOrigin,...state,failures,providerTruth:'must_verify_database'}));
 } catch(error) {const reason=error instanceof Error&&error.message.includes('strict mode violation')?'ambiguous_control':error instanceof Error&&error.name==='TimeoutError'?'control_timeout':'browser_action_failed';console.log(JSON.stringify({result:'checkout_browser_failed',stage,reason}));process.exitCode=1;}
 finally {await browser.close();}
}
