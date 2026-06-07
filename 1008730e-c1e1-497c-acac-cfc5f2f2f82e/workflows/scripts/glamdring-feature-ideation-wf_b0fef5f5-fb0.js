export const meta = {
  name: 'glamdring-feature-ideation',
  description: 'Panel of design lenses proposes interesting new features for the Glamdring reaction-combat game, each self-checked for feasibility against the real codebase',
  phases: [
    { title: 'Ideate', detail: 'one agent per design lens, each reads the repo and proposes a feature package' },
  ],
}

const REPO = String.raw`C:\Users\duran\Documents\godot\glamdring`

const SHARED_BRIEF = `
You are a senior game designer + Godot engineer reviewing an existing small game called "Glamdring".

FIRST, read these files to fully understand the game (use Read):
- ${REPO}\\CLAUDE.md  (project overview + conventions)
- ${REPO}\\gameplay.md  (authoritative rules, FSM, timings)
- ${REPO}\\plan.md  (architecture, tunable constants, layout)
- ${REPO}\\balance.json  (runtime tunables)
- ${REPO}\\fight.gd  (tick loop, swing resolves)
- ${REPO}\\player.gd  (player FSM)
- ${REPO}\\enemy.gd + ${REPO}\\enemy_basic.gd  (enemy FSM)
- ${REPO}\\combatant.gd  (base class)
- ${REPO}\\hud.gd
- ${REPO}\\sprites\\SPRITES.md  (sprite cell layout)

THE GAME: 1v1 reaction combat in Godot 4.6. Fixed 16 ticks/sec timestep. Player (left) is INVINCIBLE in v1; goal is to drop enemy HP to 0. Enemy has an FSM: idle -> threat_weak/threat_strong (telegraph) -> recovery -> idle, with an exhausted side-branch when fatigue hits 0. Player has weak attack, strong attack, block (with an 8-tick "active parry" window that drains enemy fatigue), and dodge. The core loop is "read the telegraph, find the opening": you can only damage the enemy during its recovery/exhausted windows; hitting it while idle does nothing (it blocks), and getting hit REGENERATES the enemy (passivity is punished).

HARD ARCHITECTURE CONSTRAINTS (a proposal that violates these is bad):
- NO physics, NO Area2D, NO CollisionShape — everything is stateful, manual.
- All gameplay logic runs strictly in _on_tick() at 16 Hz. Rendering via queue_redraw().
- Gameplay tunables go in balance.json (loaded by the Balance autoload). Visual/animation constants stay as const in scripts.
- Sprites are a horizontal strip, one cell per FSM stance, swapped via region_rect — NO inter-pose animation, NO AnimationPlayer. Player sheet = 7 cells, enemy_basic = 6 cells. Adding a brand-new visual stance ideally REUSES an existing cell or a modulate tint (the user would have to draw new art otherwise — call this out).
- Changes to rules/timing MUST be sync-able to gameplay.md + plan.md (note this, don't write them).

YOUR LENS: ${'{LENS}'}

Through THIS lens, propose a COHESIVE package of 2-4 new features that would make the game genuinely more interesting/fun WITHOUT breaking the careful existing design. Each feature must be concrete and tied to the real code: name the exact files, FSM states, and balance.json keys you'd add or change, with specific tick timings/values. Prefer features that need no new sprite art (reuse cells / tints / pure fx); if a feature needs art, say so and give an art-free fallback.

Be bold and specific — the user explicitly asked to be surprised. But every idea must be implementable in this tick-based, no-physics, sprite-swap architecture. Self-assess feasibility honestly.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['packageName', 'theme', 'features', 'cohesionRationale', 'feasibilityScore', 'feasibilityConcerns', 'topPick'],
  properties: {
    packageName: { type: 'string' },
    theme: { type: 'string', description: 'one sentence: the through-line of this package' },
    features: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'pitch', 'mechanics', 'filesTouched', 'newStates', 'newBalanceKeys', 'needsNewSpriteArt', 'spriteWorkaround', 'juiceFactor', 'depthFactor', 'effort', 'risks'],
        properties: {
          name: { type: 'string' },
          pitch: { type: 'string', description: '1-2 sentences on why it is fun' },
          mechanics: { type: 'string', description: 'detailed gameplay rules incl. tick timings and resolve order' },
          filesTouched: { type: 'array', items: { type: 'string' } },
          newStates: { type: 'array', items: { type: 'string' }, description: 'new FSM states, or empty' },
          newBalanceKeys: { type: 'array', items: { type: 'string' } },
          needsNewSpriteArt: { type: 'boolean' },
          spriteWorkaround: { type: 'string', description: 'how to do it art-free, or "" if it needs art' },
          juiceFactor: { type: 'integer', description: '1-5, how much it improves game feel' },
          depthFactor: { type: 'integer', description: '1-5, how much strategic depth it adds' },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          risks: { type: 'string' },
        },
      },
    },
    cohesionRationale: { type: 'string', description: 'why these features work together' },
    feasibilityScore: { type: 'integer', description: '1-10 honest self-assessment of how cleanly this fits the architecture' },
    feasibilityConcerns: { type: 'string' },
    topPick: { type: 'string', description: 'if only ONE feature from this package could ship, which and why' },
  },
}

const LENSES = [
  { key: 'skill-ceiling', lens: 'SKILL CEILING & MASTERY — features that reward precise timing and reading, give the expert player tools to express skill (perfect-parry/riposte, just-frame inputs, punish windows, stagger/poise). Make the existing "find the opening" loop deeper for someone who has mastered the basics.' },
  { key: 'juice-feel', lens: 'JUICE & GAME FEEL — features that make every hit and moment satisfying within a sprite-swap + draw_rect engine: hit-stop/freeze-frames, screen flash, slow-mo, dynamic camera zoom/shake, afterimages, particles, chromatic punch, sound-cue hooks. Pure feel, minimal new rules, maximal "wow".' },
  { key: 'ai-depth', lens: 'ENEMY AI DEPTH & VARIETY — make the opponent less predictable and more alive: feints/cancels, multi-hit combo strings, adaptive behaviour that reads the player, delayed/charged attacks, unblockable tells, a second enemy archetype (note skeleton-basic.png exists in sprites/). New reads and mind-games for the player.' },
  { key: 'risk-reward', lens: 'RISK / REWARD SYSTEMS & STAKES — meters and resources that create meaningful decisions: a rage/momentum/focus meter that builds and is spent, combo counters with damage scaling, an optional player-HP/lose-condition mode that raises stakes, high-risk-high-reward attack options, "execute" finishers on low-HP enemies.' },
  { key: 'meta-replay', lens: 'REPLAYABILITY & PROGRESSION — reasons to play again: endless waves of escalating enemies, a score/combo-rank system (S/A/B/C), run modifiers/mutators, a duel timer with bonuses, unlockable enemy variety, difficulty ramps. Keep it inside the single fight.tscn scene where possible.' },
]

phase('Ideate')
const proposals = await parallel(LENSES.map(L => () =>
  agent(SHARED_BRIEF.replace('{LENS}', L.lens), {
    label: `ideate:${L.key}`,
    phase: 'Ideate',
    schema: SCHEMA,
    agentType: 'Explore',
  }).then(r => r ? { lens: L.key, ...r } : null)
))

return proposals.filter(Boolean)
