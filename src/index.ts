import { Elysia } from "elysia";
import { getProfileByNpub, getBadgesByNpub, getUser } from "./nostr";
import { generateProfileSvg } from "./svg";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { env } from "cloudflare:workers";

export default new Elysia({
  adapter: CloudflareAdapter,
})
  .get("/", () => "Nostr Profile SVG API - Access /:npub to get profile card")
  .get("/:npub", async ({ params: { npub }, set }) => {
    try {
      // npubの基本的なバリデーション
      if (!npub.startsWith("npub1") && !npub.startsWith("nprofile1")) {
        set.status = 400;
        return {
          error: "Invalid npub format. Must start with npub1 or nprofile1",
        };
      }

      const user = getUser(npub);

      // キャッシュをKVから確認
      try {
        const svg = await env.KV.get(user.pubkey);
        if (svg) {
          console.log("Cache hit for", user.pubkey);
          return new Response(svg, {
            headers: {
              "Content-Type": "image/svg+xml",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      } catch (e) {
        console.error("Error accessing KV:", e);
      }

      // Nostrプロフィールとバッジを並列で取得
      const [profile, badges] = await Promise.all([
        getProfileByNpub(user),
        getBadgesByNpub(user),
      ]);

      if (!profile) {
        set.status = 404;
        return { error: "Profile not found or timeout" };
      }

      // SVGを生成
      const svg = await generateProfileSvg(profile, npub, badges);

      // SVGをKVにキャッシュ（24時間）
      try {
        await env.KV.put(user.pubkey, svg, { expirationTtl: 3600 * 24 });
      } catch (e) {
        console.error("Error caching SVG to KV:", e);
      }

      // Content-Typeをimage/svg+xmlに設定してResponseを返す
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (error) {
      console.error("Error:", error);
      set.status = 500;
      return { error: "Internal server error" };
    }
  })
  .compile();
