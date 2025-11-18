import * as z from "zod";

const BECH32_CHARSET = "[023456789acdefghjklmnpqrstuvwxyz]";
export const NostrId = z.object({
	npub: z
		.string()
		.regex(
			new RegExp(`^npub1${BECH32_CHARSET}{58}$|^nprofile1${BECH32_CHARSET}+$`),
		),
});
