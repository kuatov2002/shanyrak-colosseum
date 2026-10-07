# Экспорт картинок значков-NFT

Картинки значков (`public/nft/<id>.png`) рисует тот же код, что и превью в игре: `src/solana/nftArt.ts`.
Чтобы перегенерировать их после изменения арта:

1. `npm run dev`
2. В консоли браузера на http://localhost:5190 выполните:

```js
await document.fonts.load("800 32px Rubik");
const { drawBadge } = await import("/src/solana/nftArt.ts");
for (const id of ["a_first", "a_perfect10", "a_height50", "a_legend"]) {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  drawBadge(c.getContext("2d"), 512, id);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  await fetch(`/__save-badge?id=${id}`, { method: "POST", body: blob });
}
```

Эндпоинт `/__save-badge` существует только в dev-сервере (`apply: "serve"`) и принимает только эти четыре id.
Уже сминченные NFT ссылаются на картинки своей версии билда, поэтому новый арт их не меняет.
