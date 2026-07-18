import {
  handlePublicProfileImageProxy,
  type PublicProfileImageProxyEnv
} from "../_shared/profileImageProxy.ts";

export async function handlePublicAvatarProxy(
  request: Request,
  env: PublicProfileImageProxyEnv,
  mediaId: string
): Promise<Response> {
  return handlePublicProfileImageProxy(request, env, mediaId, "avatar");
}

export const onRequest: PagesFunction<PublicProfileImageProxyEnv> = (context) => {
  return handlePublicAvatarProxy(context.request, context.env, context.params.mediaId as string);
};
