// Real Stripe TEST Checkout only. No tracing, screenshots, URLs or body logging.
import {chromium} from 'playwright';
const response=await fetch('http://127.0.0.1:8799/checkout',{method:'POST'});
const session=await response.json();
if(session.result!=='checkout_created') { console.log(JSON.stringify(session)); process.exitCode=1; }
else {
 const url=new URL(session.checkoutUrl);
 if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||!url.pathname.includes('/cs_test_'))throw new Error('checkout_test_origin_required');
 const browser=await chromium.launch({headless:true});
 let stage='navigation';
 try {
  const page=await browser.newPage();page.setDefaultTimeout(20000);
  await page.goto(session.checkoutUrl,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(6000);
  stage='email';
  await page.locator('#email').fill('stripe-acceptance@example.invalid');
  stage='card_selection';
  const card=page.locator('#payment-method-accordion-item-title-card');
  if(await card.count())await card.click({force:true});
  stage='card_details';
  await page.locator('#cardNumber').fill('4242424242424242');
  await page.locator('#cardExpiry').fill('1234');
  await page.locator('#cardCvc').fill('123');
  await page.locator('#billingName').fill('Synthetic Sandbox Test');
  await page.locator('#billingCountry').selectOption('US');
  if(await page.locator('#billingPostalCode').count())await page.locator('#billingPostalCode').fill('94107');
  stage='submit';
  await page.getByRole('button',{name:/^Pay/}).click();
  await page.waitForTimeout(12000);
  const state=await page.evaluate(()=>({declined:/card was declined|card has been declined/i.test(document.body.innerText),challenge:/verify you are human|complete the captcha|security check/i.test(document.body.innerText),invalid:/invalid card|invalid email/i.test(document.body.innerText)}));
  const returnOrigin=new URL(page.url()).origin==='https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev';
  console.log(JSON.stringify({result:'checkout_submitted',returnedToSandbox:returnOrigin,...state,providerTruth:'must_verify_database'}));
 } catch {console.log(JSON.stringify({result:'checkout_browser_failed',stage}));process.exitCode=1;}
 finally {await browser.close();}
}
