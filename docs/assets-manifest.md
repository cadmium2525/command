# Arcade artwork

SECRET START uses original Canvas drawings for all 18 game families and their 173 rule variants. Spaceships, blocks, paddles, tracks, mazes and markers are drawn locally by `arcade-physical.ts` and `arcade-skill.ts`. No character skits or story illustrations run during a game. The 5 × 7 bitmap alphabet, six palettes, code artwork and SVG are original code artwork dedicated under CC0 1.0.

The title screen uses `public/assets/title-world.webp` (56,226 bytes), an original landscape generated with the built-in image_gen tool on 2026-10-23. A Canvas cartridge marked 173 sits over the landscape; titles and controls are DOM text. The image contains no text or characters. Generated images are OpenAI outputs under applicable OpenAI terms and are not labeled CC0. No API key, paid external image service or remote image is required.

`src/assets/registry.ts` retains the historical asset inventory for compatibility. `ending-world.webp` and the old character helpers remain source assets from the earlier version; the arcade runtime does not display them. They are not needed for collection or completion. The completion bonus uses a playable arcade engine and the same post-game title reveal.

All assets ship locally. The title falls back to Canvas scenery if its image cannot load. Each game uses a 320 × 200 logical playfield with nearest-neighbor display scaling; readable Japanese controls and results use browser text outside/over the canvas. Reduced motion removes decorative title movement and result animation while preserving playable simulation.
