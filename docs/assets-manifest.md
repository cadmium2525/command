# Original artwork and replacement slots

SECRET START ships two original AI-generated landscape images, original code-drawn pixel art, and an original SVG. The code-drawn art and SVG are dedicated under **CC0 1.0**. Generated images are OpenAI outputs subject to the applicable OpenAI terms, and are not labeled CC0. No third-party image, font, audio, or remote asset is needed. The pixel alphabet is an original 5 × 7 bitmap alphabet. The canvas renderer provides six palettes, fourteen characters/objects, scenery, particles, and every minigame illustration.

The centralized inventory is `src/assets/registry.ts`. Each narrative references actor IDs and `world`; unknown IDs resolve to the original built-in hero. Procedural records have a null path because their source is `src/events/art.ts`. The optional vector cartridge emblem is `public/assets/cartridge-label.svg`, registered as `cartridge-label` and available through `ASSET_PATHS.cartridgeLabel`.

| IDs | Delivered artwork | Replacement contract | Status |
| --- | --- | --- | --- |
| hero, cat, ghost, robot, slime, bird | Original animated pixel characters | 24 × 24 logical pixels; bottom-center origin; transparent background | Ready |
| star, moon, fish, box, title, crown, plant, cake | Original pixel props | 24 × 24 logical pixels; bottom-center origin | Ready |
| world | Original city/space landscape, maze, river, arcade and observatory scenery | 320 × 200 logical pixels | Ready |
| cartridge-label | Original SVG decorative emblem | 96 × 96 pixels | Ready |

The built-in image_gen tool generated both landscapes on 2026-10-23 after the user's clarification. No API key, external paid API, paid stock image or new subscription was used. The environment does not disclose an exact image model identifier, so the recorded model is `built-in image_gen (model identifier not exposed)`. Images contain no title or UI text. They were converted to WebP at 960 × 600, nearest-neighbor scaling, quality 88; Canvas displays them at a 320 × 200 logical resolution.

| ID | Project file | Size | Placement | Status |
| --- | --- | --- | --- | --- |
| titleWorld | public/assets/title-world.webp | 56,226 bytes | Title screen landscape with DOM typography and animated hero/cat | Generated, optimized, integrated |
| endingWorld | public/assets/ending-world.webp | 164,376 bytes | 173/173 completion reward, central gateway kept clear | Generated, optimized, integrated |

The complete code art remains the failure-safe alternative when images cannot load. Either landscape can be replaced through `src/assets/registry.ts` without changing the command mapping. Neither image is needed to unlock or finish any event.

## Image generation prompts

Tool: built-in image_gen. Mode: new image, opaque background. No reference images. Original outputs are retained by the image tool under the task's generated_images folder; optimized project-bound deliverables are the WebP files above.

### titleWorld

Use case: stylized-concept. Asset type: production background for an original Japanese retro browser game, SECRET START. Create a refined atmospheric landscape 8:5 aspect ratio pixel-art illustration, as if rendered at 320 by 200 logical pixels and enlarged with sharp nearest-neighbor edges. A tiny mysterious glowing amber doorway stands on a little grassy stone platform in the bottom center, suspended over a deep teal night valley. Silhouette pine trees, layered low mountain ridges, a few warm window lights, a delicate star field and small crescent moon. Palette restrained dark pine green, charcoal teal, desaturated sage, warm golden amber, creamy highlights. Beautiful coherent 16-bit game background, crisp deliberate pixel clusters, subtle dithering, limited colors. The TOP 60 PERCENT is predominantly calm dark teal night sky with only a few tiny stars, plenty of clean negative space where game title text will be overlaid in code. Main environmental detail lives in bottom 40 percent. Flat front-facing side-view composition, no perspective UI, no frame, no console. No characters, no letters, NO TEXT, no lettering, no numbers, no logos, no watermark. The emotion is quiet curiosity and a secret waiting to open. Deliver actual image asset.

### endingWorld

Use case: stylized-concept. Asset type: production true-ending illustration for the original retro pixel game SECRET START. Landscape 8:5 aspect ratio, pixel art designed at 320x200 logical resolution, hard clean pixel clusters and nearest-neighbor look. A tiny original traveler with a square cream head, green tunic, and amber scarf stands from behind at bottom center beside a small cream-colored cat, looking at a gigantic golden rectangular door opening into a bright dawn. A magical valley spreads below them: floating islands, a small wooden house, pine trees, constellations turning into warm fireflies, an old robot and a little friendly ghost waving at the traveler from opposite sides. A wide sunrise on the horizon, amber and butter yellow sunlight against dark teal and sage green land. Rich professional 16-bit scene with thoughtful handmade pixel details, subtle dithering, dramatic but tender final moment. Bottom 25 percent a dark foreground where DOM captions will overlay. Upper middle clear luminous portal as focal point, entire scene readable at tiny scale. No UI, no frame, no console. Absolutely NO TEXT, no letters, no symbols forming writing, no numbers, no logo or watermark. Deliver actual image asset.

Art is rendered on a 320 × 200 logical canvas with nearest-neighbor scaling. Reduced motion suppresses scene shaking, spinning, flicker, and ornamental movement while preserving elapsed-time progression, controls, and completion. All images are local; failure to load optional decoration leaves the canvas artwork intact.
