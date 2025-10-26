import { nip19, SimplePool, type Event } from 'nostr-tools';

const RELAYS = [
  'wss://yabu.me',
  'wss://relay.damus.io',
  'wss://relay.nostr.band'
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
  pubkey: string
  relays: string[] | null
}

function getUser(userKey: string): User {
  const decoded = nip19.decode(userKey);
  if (decoded.type !== 'nprofile' && decoded.type !== 'npub') {
    throw new Error('Invalid nprofile format');
  }
  switch (decoded.type) {
    case 'nprofile':
      return {
        pubkey: decoded.data.pubkey,
        relays: decoded.data.relays || null
      }
    case 'npub':
      return {
        pubkey: decoded.data,
        relays: null
      };
  }
}

export async function getProfileByNpub(npub: string): Promise<NostrProfile | null> {
  try {
    // npubをhexに変換
    const userData = getUser(npub);

    // SimplePoolを使ってリレーに接続
    const pool = new SimplePool();

    // kind0イベントを取得（2.5秒タイムアウト）
    const event = await Promise.race([
      pool.get(userData.relays || RELAYS, {
        kinds: [0],
        authors: [userData.pubkey],
        limit: 1
      }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 2500)
      )
    ]);

    // プールを閉じる
    pool.close(RELAYS);

    if (!event) {
      return null;
    }

    // content JSONをパース
    const profile: NostrProfile = JSON.parse(event.content);
    return profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

export async function getBadgesByNpub(npub: string): Promise<Badge[]> {
  try {
    // npubをhexに変換
    const userData = getUser(npub);

    const pool = new SimplePool();

    // kind 30008 (プロフィールバッジ) を取得
    const profileBadgesEvent = await Promise.race([
      pool.get(userData.relays || RELAYS, {
        kinds: [30008],
        authors: [userData.pubkey],
        '#d': ['profile_badges']
      }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 10000)
      )
    ]);

    if (!profileBadgesEvent) {
      pool.close(RELAYS);
      return [];
    }

    // aタグを解析してバッジ定義の参照を取得
    const aTags = profileBadgesEvent.tags.filter(tag => tag[0] === 'a');

    // 最大5つまで取得
    const badgeReferences = aTags.slice(0, 5);

    if (badgeReferences.length === 0) {
      pool.close(RELAYS);
      return [];
    }

    // 各バッジ定義を取得
    const badges: Badge[] = [];

    for (const aTag of badgeReferences) {
      const badgeAddress = aTag[1]; // format: kind:pubkey:d_tag
      const parts = badgeAddress.split(':');

      if (parts.length !== 3 || parts[0] !== '30009') {
        continue;
      }

      const [, badgeAuthor, dTag] = parts;

      // kind 30009 (バッジ定義) を取得
      const badgeDefEvent = await Promise.race([
        pool.get(RELAYS, {
          kinds: [30009],
          authors: [badgeAuthor],
          '#d': [dTag]
        }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
      ]);

      if (badgeDefEvent) {
        const badge: Badge = {};

        // タグから情報を抽出
        for (const tag of badgeDefEvent.tags) {
          if (tag[0] === 'name' && tag[1]) {
            badge.name = tag[1];
          } else if (tag[0] === 'description' && tag[1]) {
            badge.description = tag[1];
          } else if (tag[0] === 'image' && tag[1]) {
            badge.image = tag[1];
          } else if (tag[0] === 'thumb' && tag[1]) {
            badge.thumb = tag[1];
          }
        }

        badges.push(badge);
      }
    }

    pool.close(RELAYS);
    return badges;
  } catch (error) {
    console.error('Error fetching badges:', error);
    return [];
  }
}
