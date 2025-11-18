import { waitUntil } from "cloudflare:workers";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { getBadgesByNpub, getProfileByNpub, getUser, type User } from "./nostr";
import { generateProfileSvg } from "./svg";
import { NostrId } from "./types/validation";
import { getKV, setKV } from "./utils/cache";

const generateProfile = async (userId: User): Promise<string> => {
	const [profile, badges] = await Promise.all([
		getProfileByNpub(userId),
		getBadgesByNpub(userId),
	]);
	if (!profile) {
		throw new Error("User not found");
	}

	const svg = await generateProfileSvg(profile, badges);
	await setKV(userId.pubkey, svg);
	return svg;
};

const HEADER = {
	"content-type": "image/svg+xml",
	"cache-control": "public, max-age=3600",
};

const app = new Hono();

app.get("/", (c) => {
	return c.text("Nostr Profile SVG API - Access /:npub to get profile card");
});

app.get(
	"/:npub",
	validator("param", (params, c) => {
		const npub = params.npub;
		const parsed = NostrId.safeParse({ npub });
		if (!parsed.success) {
			return c.text("Invalid!", 401);
		}
		return parsed.data;
	}),
	async (c) => {
		const params = c.req.valid("param");
		const user = getUser(params.npub);
		const cachedProfile = await getKV(user.pubkey);
		if (cachedProfile) {
			waitUntil(generateProfile(user));
			return c.body(cachedProfile, 200, HEADER);
		}
		try {
			const result = await generateProfile(user);
			return c.body(result, 200, HEADER);
		} catch (e) {
			console.error(e);
			return c.body("Error: User not found.", 404);
		}
	},
);

export default app;
