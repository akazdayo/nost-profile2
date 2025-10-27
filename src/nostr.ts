import { nip19, SimplePool, verifyEvent, type Event } from "nostr-tools";

const RELAYS = [
  "wss://yabu.me",
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
];

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

export async function getProfileByNpub(
  userData: User,
): Promise<NostrProfile | null> {
  try {
    // SimplePoolを使ってリレーに接続
    const pool = new SimplePool();

    // kind0イベントを取得（2.5秒タイムアウト）
    const event = await Promise.race([
      pool.get(userData.relays || RELAYS, {
        kinds: [0],
        authors: [userData.pubkey],
        limit: 1,
      }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 2500),
      ),
    ]);

    // プールを閉じる
    pool.close(userData.relays || RELAYS);

    if (!event) {
      return null;
    }

    // イベントの署名を検証
    if (!verifyEvent(event)) {
      console.error("Invalid event signature");
      return null;
    }

    // content JSONをパース
    const profile: NostrProfile = JSON.parse(event.content);
    return profile;
  } catch (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
}

export async function getBadgesByNpub(userData: User): Promise<Badge[]> {
  try {
    const pool = new SimplePool();

    // kind 8 (バッジ授与イベント) を取得
    const badgeAwardEvents = await Promise.race([
      pool.querySync(userData.relays || RELAYS, {
        kinds: [8],
        "#p": [userData.pubkey],
      }),
      new Promise<Event[]>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000),
      ),
    ]);

    if (!badgeAwardEvents || badgeAwardEvents.length === 0) {
      pool.close(userData.relays || RELAYS);
      return [];
    }

    // 受取日（created_at）で降順ソート
    const sortedEvents = badgeAwardEvents
      .filter((event) => verifyEvent(event))
      .sort((a, b) => b.created_at - a.created_at);

    // 最大5つまで取得
    const topEvents = sortedEvents.slice(0, 5);

    // 各イベントからaタグ（バッジ定義への参照）を抽出
    const badgeReferences = topEvents
      .map((event) => event.tags.find((tag) => tag[0] === "a"))
      .filter((tag): tag is string[] => tag !== undefined);

    if (badgeReferences.length === 0) {
      pool.close(userData.relays || RELAYS);
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
        const badgeDefEvent = await Promise.race([
          pool.get(RELAYS, {
            kinds: [30009],
            authors: [badgeAuthor],
            "#d": [dTag],
          }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 3000),
          ),
        ]);

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

    pool.close(userData.relays || RELAYS);
    return badges;
  } catch (error) {
    console.error("Error fetching badges:", error);
    return [];
  }
}
