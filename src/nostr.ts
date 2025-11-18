import { type Event, nip19, type SimplePool, verifyEvent } from "nostr-tools";
import type { Badge, NostrProfile, User } from "./types/nostr";

const RELAYS = ["wss://yabu.me"];

class Nostr {
	pool: SimplePool;
	constructor(pool: SimplePool) {
		this.pool = pool;
	}

	public async getProfile(userData: User): Promise<NostrProfile | null> {
		// kind0イベントを取得
		const event = await this.pool.get(userData.relays || RELAYS, {
			kinds: [0],
			authors: [userData.pubkey],
			limit: 1,
		});

		if (!event) {
			throw new Error("No profile found");
		}

		// イベントの署名を検証
		if (!verifyEvent(event)) {
			throw new Error("Invalid event signature");
		}

		// content JSONをパース
		const profile: NostrProfile = JSON.parse(event.content);
		return profile;
	}

	async getBadgeNewEvents(userData: User): Promise<Event[]> {
		const badgeAwardEvents = await this.pool.querySync(
			userData.relays || RELAYS,
			{
				kinds: [8],
				"#p": [userData.pubkey],
			},
		);
		if (badgeAwardEvents.length === 0) {
			return [];
		}

		// 受取日（created_at）で降順ソート
		const sortedEvents = badgeAwardEvents
			.filter((event) => verifyEvent(event))
			.sort((a, b) => b.created_at - a.created_at);

		// 最大5つまで取得
		const topEvents = sortedEvents.slice(0, 5);
		return topEvents;
	}

	public async getBadges(userData: User): Promise<Badge[]> {
		try {
			const topEvents = await this.getBadgeNewEvents(userData);

			// 各イベントからaタグ（バッジ定義への参照）を抽出
			const badgeReferences = topEvents
				.map((event) => event.tags.find((tag) => tag[0] === "a"))
				.filter((tag): tag is string[] => tag !== undefined);

			if (badgeReferences.length === 0) {
				return [];
			}

			// 各バッジ定義を並列取得
			const badgePromises = badgeReferences.map(async (aTag) => {
				try {
					const badgeAddress = aTag[1]; // format: kind:pubkey:d_tag
					const parts = badgeAddress.split(":");

					if (parts.length !== 3 || parts[0] !== "30009") {
						return null;
					}

					const [, badgeAuthor, dTag] = parts;

					// kind 30009 (バッジ定義) を取得
					const badgeDefEvent = await this.pool.get(RELAYS, {
						kinds: [30009],
						authors: [badgeAuthor],
						"#d": [dTag],
					});

					if (!badgeDefEvent) {
						return null;
					}

					const badge: Badge = {};

					// タグから情報を抽出
					for (const tag of badgeDefEvent.tags) {
						if (tag[0] === "name" && tag[1]) {
							badge.name = tag[1];
						} else if (tag[0] === "description" && tag[1]) {
							badge.description = tag[1];
						} else if (tag[0] === "image" && tag[1]) {
							badge.image = tag[1];
						} else if (tag[0] === "thumb" && tag[1]) {
							badge.thumb = tag[1];
						}
					}

					return badge;
				} catch (error) {
					console.error("Error fetching badge definition:", error);
					return null;
				}
			});

			// すべてのバッジ定義取得を並列実行
			const badgeResults = await Promise.all(badgePromises);

			// nullを除外して有効なバッジのみを返す
			const badges = badgeResults.filter(
				(badge): badge is Badge => badge !== null,
			);
			return badges;
		} catch (error) {
			console.error("Error fetching badges:", error);
			return [];
		}
	}
}

export function getUser(userKey: string): User {
	const decoded = nip19.decode(userKey);
	if (decoded.type !== "nprofile" && decoded.type !== "npub") {
		throw new Error("Invalid nprofile format");
	}
	switch (decoded.type) {
		case "nprofile":
			return {
				pubkey: decoded.data.pubkey,
				relays: decoded.data.relays || null,
			};
		case "npub":
			return {
				pubkey: decoded.data,
				relays: null,
			};
	}
}
