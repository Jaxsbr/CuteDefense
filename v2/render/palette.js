/**
 * palette.js — the SINGLE source of truth for every colour & font in CuteDefense V2.
 *
 * Design law (owner's brief): the MAP recedes, the ENTITIES pop, the UI is cute.
 * Enforced with a saturation + lightness hierarchy, not by accident:
 *
 *   layer        saturation    lightness    role
 *   ----------   -----------   ----------   ------------------------------
 *   MAP          33-50%        72-83%       low-sat + pale  -> recedes
 *   ENTITIES     58-100%       42-68%       high-sat + mid  -> pops hard
 *   COIN/PROJ    79-100%       55-65%       high-sat        -> grab targets
 *   UI           saturated candy chrome, in its own dock / on cream stickers
 *
 * MAP tokens are the "saccharide" pastels; entity/UI accents are saturated
 * variants invented to stand out against them.
 *
 * Pure JSON-serialisable values only (strings + numbers, no functions): the sim
 * deep-clones CONFIG via structuredClone at game start, so anything threaded into
 * config must survive a structured clone. All colour work still happens at BAKE
 * time or as single solid fillStyle assignments — this module adds ZERO per-frame
 * allocation.
 */
export const PALETTE = {
  // -- MAP: saccharide pastels, low-sat / high-light, RECEDES (tile fills only) --
  map: {
    grass:     '#D6E3C3', // hsl(84,36%,83%)   pale sage  (checker A / open tile)
    grassDark: '#C7D7B0', // hsl(85,33%,77%)   deeper sage (checker B)
    path:      '#E2CFA4', // hsl(43,52%,77%)   warm sand road (darker than grass so buildable≠walkable reads)
    pathDark:  '#D8C49A', // hsl(40,38%,73%)   sand inset
    start:     '#9BD6A8', // hsl(133,42%,72%)  mint "IN" tile
    end:       '#E4ADB0', // hsl(357,50%,79%)  dusty-rose "OUT" tile
  },

  // -- GOAL markers: dark inks/accents for the baked IN(burrow)/OUT(flag) icons --
  // (kept OUT of `map` so the pale-tile lightness law isn't polluted by inks)
  goal: {
    inDark:  '#2E6B43', // deep green door/burrow on the mint tile
    inLight: '#E8FBEE',
    outDark: '#9E4B52', // deep rose flag pole on the rose tile
    outFlag: '#FF7E8A',
  },

  // -- ENEMIES: saturated mid-tones, POP on the pale map ------------------------
  // SpriteCache bakes body = radial centre-light grad + `border` outline + `glow`
  // halo. `color` is the MID tone. (Gradient standardised to the towers' radial.)
  enemies: {
    basic:           { color: '#FF5A5F', border: '#E03A4A', glow: '#FFB3B8' }, // candy red  hsl(358,100,68)
    fast:            { color: '#22C3C9', border: '#15868C', glow: '#8DEBEF' }, // turquoise  hsl(182,71,46)
    strong:          { color: '#2E9BD6', border: '#245A9E', glow: '#A9CBF2' }, // azure      hsl(201,67,51)
    boss_shield:     { color: '#A14FD1', border: '#6B2E9E', glow: '#D9B0F0' }, // grape      hsl(278,58,56)
    boss_speed:      { color: '#F0433C', border: '#C22822', glow: '#FF9E96' }, // crimson    hsl(2,86,59)
    boss_regenerate: { color: '#1FB562', border: '#157A42', glow: '#8FE6B5' }, // emerald    hsl(147,71,42)
    boss_split:      { color: '#FF9417', border: '#D6700A', glow: '#FFC880' }, // tangerine  hsl(32,100,55)
    boss_splitling:  { color: '#FFB23E', border: '#D6820A', glow: '#FFD98A' }, // amber shard — a paler splinter of the star (secret-wave split child)
  },

  // -- TOWERS: saturated bodies; SpriteCache bakes radial centre-light grad ------
  towers: {
    basic:  { body: '#5B9DF0', projectile: '#4D8FFF' }, // periwinkle / bright bolt
    strong: { body: '#8453E8', projectile: '#FF5630' }, // violet / hot bomb
    // BOSS (W8 / reworked V2.2): the late-game CHAMPION tower — the player's KEY to
    // the secret summit. V2.1 made it an off-palette obsidian/crimson villain; V2.2
    // brings it back INTO the soft candy palette as a friendly-but-MIGHTY crowned
    // monarch. It reads "boss" through SIZE (the 2x2 bake), a chunky royal BORDER, a
    // gold CROWN, and a big confident FACE — never through darkness. Hue: orchid-
    // magenta, a free lane distinct from the periwinkle (basic) and blue-violet
    // (strong) towers. L2 brightens the crown gem + aura and bolds the face.
    boss: {
      body:       '#D26FC8', // orchid-magenta royal keep (hsl ~307,52%,63% — SOFT, not dark)
      projectile: '#F08CD0', // soft magenta-pink bolt (was crimson; now in-palette)
      crown:      '#FFD86B', // soft gold crown — the BOSS-rank tell (hue ~44)
      gem:        '#7FE3FF', // sky crown gem (L1 calm cyan; L2 brightens)
      border:     '#A23F9C', // deep orchid chunky rim (boss-weight outline)
      glow:       '#F6BCEE', // pale orchid aura halo
    },
  },

  // -- COIN: the eye-catching grab target, vivid gold lifecycle -----------------
  coin: {
    normal:  { body: '#FFCB2E', border: '#E89B1C', glow: '#FFE899' },
    warning: { body: '#FF8C42', border: '#E85A1E', glow: '#FFB066' },
    expired: { body: '#8A8A8A', border: '#F0524F', glow: '#FF8E8B' },
  },

  // -- GOLD: ONE coin-economy thread (HUD coin, badges, level rings, sparkles) ---
  gold: { base: '#FFCB2E', deep: '#E89B1C', pale: '#FFE899', l3glow: '#FF6B81' },

  // -- FX: soft, warm, on-palette -----------------------------------------------
  fx: {
    hpGood:          '#54C98A',
    hpMid:           '#F0C637',
    hpLow:           '#F2746E',
    explosionStroke: '#FF8A1E',
    explosionFill:   '#FFCB6B',
    annBoss:         '#FF8A1E',
    annComplete:     '#54C98A',
    win:             '#54C98A',
    lose:            '#F2746E',
  },

  // -- FONTS: two web-safe stacks for body/display (clears the Arial-everywhere
  //    tell) + the title's deliberate round-vs-rugged contrast pair -------------
  font: {
    display: '"Trebuchet MS", Verdana, system-ui, sans-serif',   // headings, buttons
    body:    'Verdana, "Trebuchet MS", system-ui, sans-serif',   // numerals, stats
    round:   '"Chalkboard SE", "Comic Sans MS", "Marker Felt", system-ui, sans-serif', // title "Cute"
    rugged:  '"Impact", "Haettenschweiler", "Arial Black", sans-serif',                // title "Defense"
  },

  // -- UI: saturated candy chrome — one flat, unified token set ------------------
  // (merges the dock / map-popup / accent-ramp proposals from the design fan-out)
  ui: {
    // HUD dock (grape gradient + right rail + candy top stripe)
    dockTop: '#6E5DBA', dockBottom: '#5B4CA0', dockEdge: '#4B3D85',
    accent: '#FF8FB3', ribbonA: '#FF9EC4', ribbonB: '#FFC59E', ribbonC: '#FFE6A3',

    // cards (cream on the grape dock)
    cardBg: '#F6F0FF', cardBorder: '#C9B8F0',
    textPrimary: '#FFFFFF', textSecondary: '#DCD2EC', textOnCard: '#5A3D6B',

    // accent ramp (chips, labels, meters)
    pink: '#FF5C8A', pinkSoft: '#FFC0D2', pinkDeep: '#E23B5B',
    gold: '#FFCB2E', goldSoft: '#FFE899', goldDeep: '#C8881A',
    sky: '#4FB8E8', skySoft: '#BFE8F7', skyDeep: '#2F93C4',
    mint: '#43C59E', coral: '#FF7A59',
    boss: '#FF8A3D', bossSoft: '#FFE3CC',
    heart: '#FF6F91', heartHurt: '#E2557A',

    // buttons (canonical set; *Edge = darker 3D rim)
    btnPrimary: '#34C36B', btnPrimaryEdge: '#1F8F4D',
    btnInfo: '#4FA3E0', btnInfoEdge: '#2E6FB0',
    btnWarn: '#F2944A', btnWarnEdge: '#C86B22',
    btnDanger: '#FF6B8A', btnDangerEdge: '#D63B63',
    btnDisabled: '#9A93A8', btnDisabledEdge: '#6F6880',

    // W4 — ability ramp: field-freeze ICE identity, deliberately distinct from the
    // admin btn* candy ramp so the freeze reads as YOUR power, not another toggle.
    // (These were hardcoded at Renderer._freezeButton; named + promoted here to
    //  satisfy the no-magic-colors rule. The READY/COOLDOWN pair preserves the
    //  original P3 look; ACTIVE/LOCKED are the new states.)
    freezeReady: '#5BC8F0', freezeReadyEdge: '#2E7FB8',
    freezeActive: '#7FE3FF', freezeActiveEdge: '#3FA8D6',
    freezeCooldown: '#8FA3B3', freezeCooldownEdge: '#5A6B7A',
    freezeLocked: '#A9B4C2', freezeLockedEdge: '#7A8694',
    freezeSweep: '#EAFBFF', abilityLabel: '#CFE8FF',

    // V2.2 — ULTIMATE ("Boss Beam") ability ramp: a hot crimson/ember identity (the
    // boss tower's aimed beam) distinct from the ICE freeze ramp, so the two powers never
    // read as the same control. READY = bright ember, ACTIVE = white-hot flash,
    // COOLDOWN/LOCKED = dim ash. Mirrors the freeze 4-state look.
    ultReady: '#FF5630', ultReadyEdge: '#C2280F',
    ultActive: '#FFB37A', ultActiveEdge: '#E8771E',
    ultCooldown: '#A8857A', ultCooldownEdge: '#6F564E',
    ultLocked: '#B6A9A2', ultLockedEdge: '#84736B',
    ultSweep: '#FFE3CC',

    // map popup (cream "sticker" that sits ON the light map)
    popupPanel: '#FFF7F0', popupEdge: '#FF8FB1', popupShadow: '#5B507033', popupHi: '#FFFFFFCC',

    // shared range circle (white dash + faint dark halo so it reads on the pale map)
    rangeDash: '#FFFFFFCC', rangeHalo: '#3A2E5540', rangeFill: '#FFFFFF14',

    // overlays (warm/grape frosted, NOT mud-black)
    scrim: '#2A1B4D',

    // start menu backdrop + wordmark
    menuSky: '#A6C7E7', menuSkyMid: '#C3DEEB', menuSkyBot: '#FFF7F0',
    menuHillBack: '#A0CAC2', menuHillFront: '#C8DCBE',
    title: '#FF7FB0', subtitle: '#7E78A8',

    // corner radii by element class (VARY by class — anti uniform-radius tell)
    radPanel: 26, radCard: 18, radButton: 14, radChip: 16,
  },
};

export default PALETTE;
