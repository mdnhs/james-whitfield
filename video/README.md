# Promo video (Remotion)

৬০ সেকেন্ডের প্রোমো ভিডিও, 1920×1080, 30fps। এটা সাইট থেকে আলাদা একটা প্রজেক্ট, নিজের `package.json` আছে।

## চালানোর নিয়ম

```bash
cd video
npm install
npm run dev      # Remotion Studio খুলবে, ব্রাউজারে লাইভ প্রিভিউ আর টাইমলাইন দেখা যাবে
npm run render   # out/promo.mp4 ফাইল বানাবে
```

## কোথায় কী বদলাবেন

- **লেখা:** `src/content.ts`। সব টেক্সট এই এক জায়গায় রাখা।
- **রং ও ফন্ট:** `src/theme.ts`। এগুলো সাইটের `site.css` থেকে নেওয়া।
- **কোন সিন কতক্ষণ চলবে:** `src/theme.ts`-এর `SCENES` (ফ্রেমে লেখা, 30 ফ্রেম = 1 সেকেন্ড)।
- **প্রতিটা সিনের ডিজাইন:** `src/scenes/*.tsx`
- **ছবি:** `public/images/`

## মিউজিক যোগ করতে চাইলে

একটা অডিও ফাইল `public/music.mp3` নামে রাখুন। তারপর `src/MainVideo.tsx`-এ এভাবে বসান:

```tsx
import { Audio } from "remotion"
// <AbsoluteFill> এর ভেতরে:
<Audio src={staticFile("music.mp3")} volume={0.6} />
```

## 9:16 (Reels বা Shorts) ভার্সন

`src/theme.ts`-এ `WIDTH = 1080`, `HEIGHT = 1920` করে দিন। এরপর সিনগুলোর লেআউট (padding, গ্রিড) একটু করে ঠিক করতে হবে।
