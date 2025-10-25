import { Elysia } from "elysia";
import { getProfileByNpub, getBadgesByNpub } from "./nostr";
import { generateProfileSvg } from "./svg";

const app = new Elysia()
  .get("/", () => "Nostr Profile SVG API - Access /:npub to get profile card")
  .get("/:npub", async ({ params: { npub }, set }) => {
    try {
      // npubの基本的なバリデーション
      if (!npub.startsWith('npub1')) {
        set.status = 400;
        return { error: 'Invalid npub format. Must start with npub1' };
      }

      // Nostrプロフィールとバッジを並列で取得
      const [profile, badges] = await Promise.all([
        getProfileByNpub(npub),
        getBadgesByNpub(npub)
      ]);

      if (!profile) {
        set.status = 404;
        return { error: 'Profile not found or timeout' };
      }

      // SVGを生成
      const svg = generateProfileSvg(profile, npub, badges);

      // Content-Typeをimage/svg+xmlに設定
      set.headers['Content-Type'] = 'image/svg+xml';
      set.headers['Cache-Control'] = 'public, max-age=3600'; // 1時間キャッシュ

      return svg;
    } catch (error) {
      console.error('Error:', error);
      set.status = 500;
      return { error: 'Internal server error' };
    }
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
