import {
  handlePublicProfileImageProxy,
  type PublicProfileImageProxyEnv
} from "../_shared/profileImageProxy.ts";

export async function handlePublicBannerProxy(
  request: Request,
  env: PublicProfileImageProxyEnv,
  mediaId: string
): Promise<Response> {
  return handlePublicProfileImageProxy(request, env, mediaId, "banner");
}

export const onRequest: PagesFunction<PublicProfileImageProxyEnv> = (context) => {
  return handlePublicBannerProxy(context.request, context.env, context.params.mediaId as string);
};
