export interface NostrProfile {
	name?: string;
	display_name?: string;
	about?: string;
	picture?: string;
	banner?: string;
	nip05?: string;
	lud16?: string;
	website?: string;
}

export interface Badge {
	name?: string;
	description?: string;
	image?: string;
	thumb?: string;
}

export type User = {
	pubkey: string;
	relays: string[] | null;
};
