import { env } from "cloudflare:workers";

export const getKV = async (
	key: string,
): Promise<string | undefined | null> => {
	const value = await env.KV.get(key).catch((e) => {
		console.error("Error accessing KV:", e);
	});
	return value;
};

export const setKV = async (key: string, value: string): Promise<void> => {
	await env.KV.put(key, value).catch((e) => {
		console.error("Error setting KV:", e);
	});
};
