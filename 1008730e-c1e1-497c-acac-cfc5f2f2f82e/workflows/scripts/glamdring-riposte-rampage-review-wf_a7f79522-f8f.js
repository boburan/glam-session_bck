export const meta = {
  name: 'glamdring-riposte-rampage-review',
  description: 'Adversarial multi-dimension review of the Riposte & Rampage implementation: GDScript/Godot correctness, gameplay logic/edge-cases, and docs consistency',
  phases: [
    { title: 'Review', detail: 'three independent reviewers (engine correctness, gameplay logic, docs consistency)' },
    { title: 'Verify', detail: 'adversarially re-check each non-trivial finding before it is reported' },
  ],
}

const REPO = 'C:\\Users\\duran\\Documents\\godot\\glamdring'

const CONTEXT = `
PROJECT: Glamdring — 1v1 reaction combat, Godot 4.6, fixed 16 ticks/sec. Player invincible (v1),
goal = enemy hp to 0. All gameplay logic in fight.gd _on_tick(). Tunables in balance.json via the
Balance autoload. Sprites = one cell per stance, region_rect swap, NO animation; new visual states
reuse cells + a modulate tint. No physics / no Area2D.

A feature package "RIPOSTE & RAMPAGE" was just implemented. Summary of intended behavior:
- F1 PERFECT PARRY -> STAGGER + RIPOSTE: active parry (player blocking a WEAK enemy swing within
  block_active_ticks of holding block) drains enemy fatigue AND arms a riposte (player.set_riposte_ready).
  While riposte_ready_ticks > 0, the player's next DAMAGING hit is x riposte_damage_multiplier, then
  consumed (a whiff does not consume). PERFECT parry (blocking_ticks_elapsed <= perfect_parry_ticks at
  swing resolve, a strict subset of active parry) additionally staggers the enemy: new "staggered"
  state, wide open, all hits land, for stagger_ticks.
- F2 HIT-STOP: fight.gd freezes the tick loop for hitstop_* real seconds on impacts (weak/strong/parry/
  stagger), while shake+particles+redraw keep running. Gameplay-neutral.
- F3 COMBO + RANK: player.combo increments on every damaging player hit; resets on getting hit or after
  combo_timeout_ticks; max_combo tracks best. Rank C/B/A/S by thresholds 1/5/10/15. HUD shows combo+rank
  top-center and max combo on win.
- F4 ENEMY FEINTS: a weak threat is, with feint_probability, a FEINT — telegraphs identically but does
  NOT swing; snaps to a short idle (feint_idle_ticks) and re-decides. Strong never feints.
- F5 READABILITY TINTS + EXECUTE: threat-onset pulse tint (threat_pulse_ticks), staggered cyan tint,
  player riposte-ready gold tint; execute = when enemy.hp <= execute_threshold_hp, player hits deal
  x execute_damage_multiplier (stacks with riposte; round once at end) and enemy shows a red tint.
  Modulate priority (highest first): hit_flash > (player riposte / enemy staggered) > threat pulse >
  execute > white.

TICK ORDER in fight._on_tick(): player.tick(); enemy.tick(); player.handle_input(); resolve enemy swing;
resolve player swing; fatigue->exhausted; win check; hud.

FILES (all under ${REPO}): fight.gd, player.gd, enemy.gd, enemy_basic.gd, combatant.gd, hud.gd,
balance.gd, balance.json, gameplay.md, plan.md, sprites/SPRITES.md, CLAUDE.md.
`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dimension', 'findings', 'overallAssessment'],
  properties: {
    dimension: { type: 'string' },
    overallAssessment: { type: 'string', description: 'one paragraph: is the implementation correct/shippable?' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'location', 'issue', 'suggestedFix', 'confidence'],
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
          file: { type: 'string' },
          location: { type: 'string', description: 'function name / line range' },
          issue: { type: 'string', description: 'concrete description of the problem and why it is wrong' },
          suggestedFix: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isReal', 'severity', 'reasoning', 'fix'],
  properties: {
    isReal: { type: 'boolean', description: 'true if this is a genuine defect that should be fixed' },
    severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit', 'not-a-bug'] },
    reasoning: { type: 'string', description: 'after re-reading the actual code, why real or not' },
    fix: { type: 'string', description: 'concrete fix if real, else ""' },
  },
}

const DIMENSIONS = [
  {
    key: 'engine',
    brief: `ENGINE CORRECTNESS. Read fight.gd, player.gd, enemy.gd, enemy_basic.gd, combatant.gd, hud.gd, balance.gd.
Check for GDScript 4.x syntax/type errors, Godot 4.6 API misuse, runtime errors (null refs, wrong arg counts,
type mismatches int vs float, StringName vs String, Dictionary with conflicting keys, calling undefined symbols),
and CROSS-FILE CONTRACT MISMATCHES (does fight.gd call methods/fields that exist with the exact signatures in
player.gd/enemy.gd/hud.gd? does hud.update arg count match the call?). Verify _process hitstop pump cannot
deadlock or skip swing resolution, and that round()/int() conversions are valid. Flag anything that would fail
to parse or crash at runtime.`,
  },
  {
    key: 'gameplay',
    brief: `GAMEPLAY LOGIC & EDGE CASES. Read fight.gd, player.gd, enemy.gd, enemy_basic.gd, gameplay.md. Trace the
tick order. Verify: (1) riposte is armed only on active parry, consumed only on a damaging hit, never double-
applied; (2) perfect parry is a strict subset of active parry and correctly triggers stagger; (3) staggered enemy
takes hits and cannot act, and exits to idle; (4) feints never swing (incl. the defensive same-zero-tick branch),
don't soft-lock, and re-decide; (5) combo increments only on damage, resets on player hit + timeout, max_combo
persists; (6) execute & riposte multipliers stack and round once; (7) hit-stop is gameplay-neutral and does not
drop inputs in a broken way or desync tick_acc; (8) no new exploit (e.g., infinite stagger-lock, perfect-parry
trivializing the fight, feint infinite loop). Flag balance/design risks too, but mark them minor/nit unless they
break the game.`,
  },
  {
    key: 'docs',
    brief: `DOCS CONSISTENCY. Read gameplay.md, plan.md, sprites/SPRITES.md, balance.json, balance.gd, CLAUDE.md, and
the .gd files as needed. Verify the docs were actually updated to match the shipped code: every new balance.json
key appears in plan.md's JSON block + tunable tables; gameplay.md documents riposte/perfect-parry/staggered/feint/
execute/combo with values matching balance.json (riposte x1.6, perfect_parry 3t, stagger 16t, feint 0.15,
execute <=25hp x1.5, combo timeout 48t, rank tiers 1/5/10/15); FSM diagrams include staggered + feint; SPRITES.md
documents the staggered cell reuse + tints + modulate priority. Flag any doc that is missing, stale, or contradicts
the code (wrong number, missing state, etc). Also check CLAUDE.md doesn't need an update for the new mechanics.`,
  },
]

phase('Review')
const reviews = await pipeline(
  DIMENSIONS,
  d => agent(CONTEXT + '\n\nYOUR REVIEW DIMENSION:\n' + d.brief +
    '\n\nRead the actual files (do not trust this summary over the code). Report concrete, located findings with a suggested fix and your confidence. Be precise; an empty findings list is fine if the code is clean.',
    { label: 'review:' + d.key, phase: 'Review', schema: FINDINGS_SCHEMA, agentType: 'Explore' }),
  // Verify stage: adversarially re-check each non-nit finding against the real code.
  (review, dim) => {
    const toCheck = (review && review.findings ? review.findings : []).filter(f => f.severity !== 'nit')
    if (toCheck.length === 0) return review
    return parallel(toCheck.map(f => () =>
      agent('Adversarially verify this claimed defect by reading the ACTUAL code at ' + REPO + '. ' +
        'Default to isReal=false unless you can point to the exact code that is genuinely wrong. ' +
        'Claim:\nfile: ' + f.file + '\nlocation: ' + f.location + '\nseverity(claimed): ' + f.severity +
        '\nissue: ' + f.issue + '\nsuggestedFix: ' + f.suggestedFix +
        '\n\nContext for intended behavior:\n' + CONTEXT,
        { label: 'verify:' + dim.key + ':' + (f.file || '').split('\\').pop(), phase: 'Verify', schema: VERDICT_SCHEMA, agentType: 'Explore' })
        .then(v => ({ ...f, verdict: v }))
    )).then(verified => ({ dimension: review.dimension, overallAssessment: review.overallAssessment, findings: verified }))
  }
)

return reviews.filter(Boolean)
