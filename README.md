# Three Stacked Goats

Interactive leather journal mockup with a Three.js configurator and animated logo introduction.

Production domain: https://threestackedgoats.com/

Deployment target: Vercel project `three-stacked-goats` in the `anchor-b7a09568`
team, connected to `tltoan/three-stacked-goats`. Production uses the repository's
`main` branch. This is a static site served from the repository root; no install
or build command is required. Keep the `workstation/`, `refill/`, and `assets/`
folders in the deployment so the interactive previews can load their assets.

The existing GitHub Pages site is also available at
https://tltoan.github.io/three-stacked-goats/.

Local preview: run `python3 -m http.server 4173` from this folder.

Third-party library and font licenses are included in assets/.

## Refill pack

The homepage includes the three-book refill product at `#refills`, priced at $10.
Each 5 × 4 inch kraft booklet independently supports Blank, Lined, or Dotted ivory
paper. Selecting a book unties the pack, separates the booklets, and opens all
three to show their selected paper. Desktop lays the spreads side by side; mobile
stacks them vertically. The Tied pack control closes and reties them. Choices are saved locally under `3sg-refill-pack-v1`, separately from the
journal configuration. The Save button downloads the selection; it does not
submit an order or take payment.

`refill/app.js` connects the shared site controls to `refill/viewer.js`. The viewer
loads as the product approaches the viewport. Its charcoal cotton tie animation
uses `refill/assets/cord-motion.bin` and the matching JSON metadata. Keep these
files together when publishing. The standalone refill prototype remains separate.

Run `node scripts/check-refill-config.mjs` to check all 27 paper combinations,
saved-state validation, summary order, and the $10 pack price. Run
`node scripts/check-refill-motion.mjs` to check that the tie clears and the books
separate before opening, and that the final spreads do not overlap.
