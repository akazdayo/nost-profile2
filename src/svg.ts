import type { NostrProfile, Badge } from './nostr';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchImageAsDataUri(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`Error fetching image ${url}:`, error);
    // Return a default placeholder as data URI
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2UxZTRlOCIvPjwvc3ZnPg==';
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export async function generateProfileSvg(profile: NostrProfile, npub: string, badges: Badge[] = []): Promise<string> {
  const displayName = escapeXml(profile.display_name || profile.name || 'Anonymous');
  const name = escapeXml(profile.name || '');
  const about = profile.about ? escapeXml(truncateText(profile.about, 150)) : '';
  const pictureUrl = profile.picture || '';

  // Fetch and convert images to data URIs
  const picture = await fetchImageAsDataUri(pictureUrl);
  const badgeImages = await Promise.all(
    badges.map(async (badge) => {
      const imageUrl = badge.thumb || badge.image || '';
      return fetchImageAsDataUri(imageUrl);
    })
  );

  // SVG dimensions
  const width = 650;
  const height = 200;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style>
      .card {
        fill: #ffffff;
        stroke: #e1e4e8;
        stroke-width: 1;
      }
      .avatar-border {
        fill: #ffffff;
        stroke: #e1e4e8;
        stroke-width: 2;
      }
      .display-name {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 26px;
        font-weight: 600;
        fill: #24292e;
      }
      .username {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 20px;
        font-weight: 300;
        fill: #586069;
      }
      .bio {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 16px;
        fill: #24292e;
      }
      .label {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 12px;
        fill: #586069;
      }
      .npub-text {
        font-family: 'Courier New', monospace;
        font-size: 11px;
        fill: #586069;
      }
      .badge-name {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 12px;
        fill: #24292e;
        text-anchor: middle;
      }
      .badge-border {
        fill: #ffffff;
        stroke: #e1e4e8;
        stroke-width: 1;
      }
    </style>
    <clipPath id="avatar-clip">
      <circle cx="80" cy="100" r="58"/>
    </clipPath>
  </defs>

  <!-- Background card -->
  <rect class="card" x="0" y="0" width="${width}" height="${height}" rx="10"/>

  <!-- Avatar with border -->
  <circle class="avatar-border" cx="80" cy="100" r="60"/>
  <image href="${picture}" x="20" y="40" width="120" height="120" clip-path="url(#avatar-clip)" preserveAspectRatio="xMidYMid slice"/>

  <!-- Profile info -->
  <text class="display-name" x="160" y="65">${displayName}</text>
  ${name ? `<text class="username" x="160" y="95">${name}</text>` : ''}

  ${about ? `
  <!-- Bio -->
  <text class="bio" x="160" y="${name ? '135' : '115'}">
    ${about.split('\n').slice(0, 3).map((line, i) =>
    `<tspan x="160" dy="${i === 0 ? '0' : '20'}">${line}</tspan>`
  ).join('\n    ')}
  </text>
  ` : ''}

  ${badges.length > 0 ? `
  <!-- Badges -->
  <g id="badges">
    ${badges.map((badge, index) => {
    const badgeX = 382 + (index * 50); // Right-aligned: 650 - 20 - (48*5 + 2*4) = 382
    const badgeY = 40;
    const imageDataUri = badgeImages[index];

    return `
    <image href="${imageDataUri}" x="${badgeX}" y="${badgeY}" width="48" height="48" preserveAspectRatio="xMidYMid slice"/>`;
  }).join('\n    ')}
  </g>
  ` : ''}
</svg>`;
}
