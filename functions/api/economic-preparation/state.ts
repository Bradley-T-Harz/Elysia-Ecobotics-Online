import { handlePreparationState, type PreparationEnv } from "./_shared/handler.ts";
export const onRequest: PagesFunction<PreparationEnv> = context => handlePreparationState(context.request, context.env);
