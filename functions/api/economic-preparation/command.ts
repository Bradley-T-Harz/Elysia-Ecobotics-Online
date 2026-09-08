import { handlePreparationCommand, type PreparationEnv } from "./_shared/handler.ts";
export const onRequest: PagesFunction<PreparationEnv> = context => handlePreparationCommand(context.request, context.env);
