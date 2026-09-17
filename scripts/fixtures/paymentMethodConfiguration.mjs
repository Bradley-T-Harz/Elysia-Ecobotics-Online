// Synthetic data only; no provider network calls or credentials.
import {STRIPE_PERMITTED_METHODS,STRIPE_EXCLUDED_METHODS,paymentMethodConfigurationName} from '../../functions/api/billing/_shared/stripePaymentMethods.ts';
export function paymentMethodsFixture(mode='test',isDefault=false) {
 const result={id:isDefault?'pmc_defaultsynthetic':'pmc_synthetic',object:'payment_method_configuration',name:isDefault?'Default':paymentMethodConfigurationName(mode),active:true,livemode:mode==='live',is_default:isDefault,parent:null,application:null};
 for(const method of [...STRIPE_PERMITTED_METHODS,...STRIPE_EXCLUDED_METHODS]){
  const available=method!=='giropay';
  const preference=(isDefault||['card','link','ideal','sepa_debit','apple_pay','google_pay'].includes(method))&&available?'on':'off';
  result[method]={available,display_preference:{preference,value:preference}};
 }
 // Acacia does not expose crypto; unknown-field rejection is tested separately.
 delete result.crypto;
 return result;
}
