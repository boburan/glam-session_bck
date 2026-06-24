export const meta = {
  name: 'glamdring-endless-weakenemy-impl',
  description: 'Implement Endless mode + fatigue-less weak enemy (skeleton, chip-through-block) across Glamdring, one agent per disjoint file set against a frozen spec',
  phases: [
    { title: 'Implement', detail: 'parallel file-owner agents implement their file(s) against the shared spec + public contract' },
  ],
}

const REPO = '/Users/marekpalavsky/godot/glamdring'

// FROZEN SPEC — no backticks anywhere (template literal). Cross-file names fixed
// by the PUBLIC CONTRACT so parallel owners implement identical interfaces.
const SPEC = `
GLAMDRING — "ENDLESS + WEAK ENEMY" UPDATE
Game: 1v1 reaction combat, Godot 4.6, fixed 16 ticks/sec, player invincible. All gameplay
logic in fight.gd _on_tick(). Tunables in balance.json via the Balance autoload. Sprites =
one 32x32 cell per stance, region_rect swap, modulate tints, no new art. Existing features
that MUST keep working: fatigue->exhausted (basic enemy), active/perfect parry, riposte
(x1.6 next damaging hit), staggered state, combo+rank (C/B/A/S at 1/5/10/15), enemy feints,
execute (<=25hp -> x1.5 + red tint), hit-stop, threat pulse. Comments may mix Czech+English.

================ THE TWO FEATURES ================

F1. ENDLESS MODE (new default loop)
  - No more win screen. When enemy hp <= 0: score += kill bonus, wave += 1, immediately
    spawn the next enemy at the same position (456, 384), show a fading "WAVE N" banner.
  - Wave composition: waves 1-2 = weak enemy (new type below); waves 3-4 = enemy_basic;
    waves 5+ alternate basic/weak (odd wave -> basic, even wave -> weak) with MILD scaling
    applied to the BASIC enemy only (speed_scale shortens its telegraphs/recovery toward
    floors; small strong-probability bonus, capped). Weak enemy never scales.
  - Combo PERSISTS across waves (resets only on player getting hit or combo timeout).
  - Space restarts the whole run anytime (reload_current_scene), polled in the live tick.
  - SCORE = sum of damage actually dealt (chip + clean, final rounded ints) + kill bonus of
    (endless_kill_score_per_wave * wave) per kill.
  - HUD: WAVE + SCORE + max combo readout top-left; combo+rank stays top-center; the old
    VYHRA win overlay is REMOVED entirely, replaced by the transient WAVE banner.

F2. WEAK ENEMY (skeleton) — fatigue-less, chip-through-block, in new file enemy_weak.gd
  - extends Enemy. Sprite body sheet: res://sprites/skeleton-basic.png (192x32, 6 cells,
    identical layout to enemy_basic; currently a placeholder copy — note in comment).
    Weapon sheet: reuse res://sprites/enemy_basic_weapon.png (art TODO comment).
    Distinguishing visual until real art exists: bony base tint (see _base_tint hook).
  - NO fatigue: no fatigue bar drawn, never enters exhausted, no fatigue drains anywhere,
    and NO HP/fatigue regen when it hits the player (a player miss just wastes the turn).
  - CHIP: player hits while it is in idle deal REDUCED damage straight to HP:
    chip dmg = int(round(base_damage * chip_multiplier)) where base is hp_damage_weak (15)
    or hp_damage_strong (25); chip_multiplier ~0.34 -> 5 / 8 dmg. Chip hits: count toward
    SCORE, but do NOT build combo, do NOT consume riposte, do NOT get riposte/execute
    multipliers; light fx only (small gray-blue particle burst + hitstop_weak; NO hit flash).
  - FULL damage in recovery_weak/recovery_strong/staggered (riposte/execute multipliers and
    combo apply exactly as for the basic enemy). threat_* still immune.
  - Parry interactions stay: active parry vs its weak swing still arms riposte; perfect
    parry still staggers it. Only the fatigue DRAIN part disappears.
  - Weaker stats: max_hp 70, long readable telegraphs, generous recovery, mostly weak
    attacks (strong_probability 0.05), NO feints.

================ NEW balance.json SECTIONS + balance.gd ================

Add to balance.json (keep all existing keys/sections untouched):

  "enemy_weak": {
    "hp_max": 70, "chip_multiplier": 0.34,
    "threat_weak_ticks": 14, "threat_strong_ticks": 18,
    "recovery_weak_ticks": 14, "recovery_strong_ticks": 22,
    "idle_min_ticks": 24, "idle_max_ticks": 56,
    "strong_probability": 0.05, "stagger_ticks": 18, "exhausted_ticks": 48
  },
  "endless": {
    "scale_step": 0.06, "scale_cap": 1.5, "strong_prob_bonus_cap": 0.15,
    "threat_weak_floor": 4, "threat_strong_floor": 6,
    "recovery_weak_floor": 2, "recovery_strong_floor": 4,
    "banner_ticks": 24, "kill_score_per_wave": 50
  }

balance.gd:
  - Add: var enemy_weak: Dictionary = {}        # per-type tunables read by enemy_weak.gd
    Loaded in _load_balance() as: enemy_weak = data.get("enemy_weak", {}) as Dictionary
    Do NOT flatten enemy_weak into top-level vars (would collide with enemy_basic flats).
  - Add flat endless vars with defaults mirroring the JSON, parsed from an "endless" dict
    (same int()/float() pattern as the existing sections):
      var endless_scale_step: float = 0.06
      var endless_scale_cap: float = 1.5
      var endless_strong_prob_bonus_cap: float = 0.15
      var endless_threat_weak_floor: int = 4
      var endless_threat_strong_floor: int = 6
      var endless_recovery_weak_floor: int = 2
      var endless_recovery_strong_floor: int = 4
      var endless_banner_ticks: int = 24
      var endless_kill_score_per_wave: int = 50

================ PUBLIC CONTRACT (exact names/signatures — DO NOT DEVIATE) ================

combatant.gd adds:
  func max_hp() -> int                      # return Balance.hp_max  (virtual; subclasses override)
  damage_hp/heal_hp clamp with max_hp() instead of Balance.hp_max.

enemy.gd (base Enemy) adds:
  var speed_scale: float = 1.0              # endless scaling knob; 1.0 = unscaled
  var strong_prob_bonus: float = 0.0        # endless additive strong-prob bonus (basic only)
  func has_fatigue() -> bool                # base: return true
  func idle_chip_multiplier() -> float      # base: return 0.0  (0.0 sentinel = full block)
  func _base_tint() -> Color                # base: return Color.WHITE
  func _sprite_sheet() -> Texture2D         # base: return SPRITE_SHEET
  func _weapon_sheet() -> Texture2D         # base: return WEAPON_SHEET
  _ready(): FIRST line is  hp = max_hp()  , then existing body but _make_sprite(_sprite_sheet())
    and _make_sprite(_weapon_sheet()).
  _draw(): hp pct uses float(max_hp()); the fatigue-bar block wrapped in  if has_fatigue():
  _update_sprite(): final else branch assigns  mod = _base_tint()  (instead of Color.WHITE).
    Priority stays: hit_flash > staggered > threat pulse > execute > _base_tint().

enemy_basic.gd changes (scaling with floors; behavior identical at speed_scale 1.0):
  func _pick_attack(rng_): return &"strong" if rng_.randf() < clampf(Balance.strong_probability + strong_prob_bonus, 0.0, 1.0) else &"weak"
  func _threat_weak_ticks() -> int: return maxi(Balance.endless_threat_weak_floor, int(round(Balance.threat_weak_ticks / speed_scale)))
  func _threat_strong_ticks() -> int: return maxi(Balance.endless_threat_strong_floor, int(round(Balance.threat_strong_ticks / speed_scale)))
  func _recovery_weak_ticks() -> int: return maxi(Balance.endless_recovery_weak_floor, int(round(Balance.recovery_weak_ticks / speed_scale)))
  func _recovery_strong_ticks() -> int: return maxi(Balance.endless_recovery_strong_floor, int(round(Balance.recovery_strong_ticks / speed_scale)))
  (idle/exhausted/stagger/feint accessors unchanged.)

enemy_weak.gd (NEW FILE) — extends Enemy:
  # Weak skeleton: no fatigue, chip-through-block, low HP, slow readable attacks, no feints.
  const BODY_SHEET := preload("res://sprites/skeleton-basic.png")     # placeholder copy of enemy_basic.png — real skeleton art TODO
  const WEAPON_SHEET_WEAK := preload("res://sprites/enemy_basic_weapon.png")  # reuse — skeleton weapon art TODO
  const BASE_TINT := Color(0.92, 0.95, 0.82, 1.0)   # bony pale tint to tell it apart from basic until real art
  func _sprite_sheet() -> Texture2D: return BODY_SHEET
  func _weapon_sheet() -> Texture2D: return WEAPON_SHEET_WEAK
  func _base_tint() -> Color: return BASE_TINT
  func has_fatigue() -> bool: return false
  func idle_chip_multiplier() -> float: return float(Balance.enemy_weak.get("chip_multiplier", 0.34))
  func max_hp() -> int: return int(Balance.enemy_weak.get("hp_max", 70))
  func _pick_attack(rng_): return &"strong" if rng_.randf() < float(Balance.enemy_weak.get("strong_probability", 0.05)) else &"weak"
  func _pick_idle_duration(rng_): return rng_.randi_range(int(Balance.enemy_weak.get("idle_min_ticks", 24)), int(Balance.enemy_weak.get("idle_max_ticks", 56)))
  func _threat_weak_ticks() -> int: return int(Balance.enemy_weak.get("threat_weak_ticks", 14))
  func _threat_strong_ticks() -> int: return int(Balance.enemy_weak.get("threat_strong_ticks", 18))
  func _recovery_weak_ticks() -> int: return int(Balance.enemy_weak.get("recovery_weak_ticks", 14))
  func _recovery_strong_ticks() -> int: return int(Balance.enemy_weak.get("recovery_strong_ticks", 22))
  func _stagger_ticks() -> int: return int(Balance.enemy_weak.get("stagger_ticks", 18))
  func _exhausted_ticks() -> int: return int(Balance.enemy_weak.get("exhausted_ticks", 48))  # unreachable (no fatigue) but sane
  func _feint_probability() -> float: return 0.0
  (speed_scale deliberately ignored — fixed readable timings.)

hud.gd update() — NEW exact signature (show_win REMOVED, 3 endless params appended):
  func update(p_enemy_hp: int, p_enemy_fatigue: int, p_enemy_state: StringName,
      p_enemy_state_ticks: int, p_player_state: StringName, p_player_state_ticks: int,
      p_dodge_cd: int, p_combo: int, p_combo_rank: StringName, p_max_combo: int,
      p_wave: int, p_score: int, p_banner_ticks: int) -> void

fight.gd must call exactly:
  hud.update(enemy.hp, enemy.fatigue, enemy.state, enemy.state_ticks_remaining,
      player.state, p_ticks, player.dodge_cooldown_ticks,
      player.combo, player.combo_rank(), player.max_combo,
      wave, score, banner_ticks)
and uses: enemy.has_fatigue(), enemy.idle_chip_multiplier(), e.speed_scale, e.strong_prob_bonus.

================ PER-FILE IMPLEMENTATION DETAIL ================

--- combatant.gd ---
  Add max_hp() (after trigger_flash or near getters):
      func max_hp() -> int:
          return Balance.hp_max
  damage_hp: hp = clampi(hp - amount, 0, max_hp())
  heal_hp:   hp = clampi(hp + amount, 0, max_hp())
  Leave the var hp declaration as-is (Enemy._ready() sizes it).

--- enemy.gd ---
  Per contract above. Notes:
  - hp = max_hp() must be the FIRST statement of _ready() (virtual max_hp can't run in the
    var initializer; dynamically spawned enemies would otherwise start at 100).
  - Keep SPRITE_SHEET/WEAPON_SHEET consts (base accessors return them).
  - Fatigue bar block in _draw() (the fat_origin..draw_rect lines) wrapped in if has_fatigue():
  - No other behavior changes.

--- enemy_basic.gd ---
  Per contract. speed_scale defaults to 1.0 so round(x/1.0) == x and floors never bind:
  pre-endless behavior is bit-identical. Keep comments style.

--- enemy_weak.gd ---
  New file per contract. Header comment (Czech+EN ok) describing the type: fatigue-less,
  chip-through-block, low HP, slow telegraphs, no feints; placeholder art note.

--- fight.gd + fight.tscn ---
  fight.gd:
  - Add consts near the preloads/colors:
      const ENEMY_BASIC := preload("res://enemy_basic.gd")
      const ENEMY_WEAK := preload("res://enemy_weak.gd")
      const ENEMY_SPAWN_POS := Vector2(456, 384)
      const COLOR_CHIP := Color(0.7, 0.75, 0.85, 1.0)
      const PARTICLES_CHIP := 4
  - Replace var game_over with:
      var wave: int = 0
      var score: int = 0
      var banner_ticks: int = 0
  - Change @onready var enemy: Node2D = $Enemy  ->  var enemy: Node2D
    (the static Enemy node is removed from the scene; spawn is dynamic).
  - Add _ready():
      func _ready() -> void:
          _advance_wave()        # spawns wave 1 + banner
  - New funcs:
      func _advance_wave() -> void:
          wave += 1
          _spawn_enemy(wave)
          banner_ticks = Balance.endless_banner_ticks
      func _spawn_enemy(w: int) -> void:
          # composition: 1-2 weak, 3-4 basic, 5+ alternate (odd basic / even weak)
          var script: GDScript
          if w <= 2: script = ENEMY_WEAK
          elif w <= 4: script = ENEMY_BASIC
          else: script = ENEMY_BASIC if (w % 2 == 1) else ENEMY_WEAK
          var e: Node2D = script.new()
          e.position = ENEMY_SPAWN_POS
          if w >= 5:
              e.speed_scale = clampf(1.0 + float(w - 4) * Balance.endless_scale_step, 1.0, Balance.endless_scale_cap)
              e.strong_prob_bonus = minf(float(w - 4) * 0.01, Balance.endless_strong_prob_bonus_cap)
          if enemy != null and is_instance_valid(enemy):
              enemy.queue_free()
          add_child(e)
          enemy = e
      func _on_enemy_defeated() -> void:
          score += Balance.endless_kill_score_per_wave * wave
          _advance_wave()
  - _on_tick(): REMOVE the whole game_over early-return block. New top of _on_tick():
      # Space restarts the entire run at any time.
      if Input.is_key_pressed(KEY_SPACE):
          get_tree().reload_current_scene()
          return
      if banner_ticks > 0:
          banner_ticks -= 1
    Then the existing tick order unchanged (player.tick, enemy.tick, handle_input, resolve
    enemy swing, resolve player swing). Gate the exhausted transition:
      if enemy.has_fatigue() and enemy.fatigue <= 0 and enemy.state != &"exhausted":
          enemy.enter_exhausted()
    Replace the win check with (MUST stay after both resolves, before _update_hud):
      if enemy.hp <= 0:
          _on_enemy_defeated()
      _update_hud()
  - _resolve_enemy_swing():
      * active parry branch: wrap ONLY the drain in the gate —
          if enemy.has_fatigue():
              enemy.drain_fatigue(Balance.enemy_fatigue_blocked_weak)
        player.set_riposte_ready() and the perfect-parry enter_stagger() path stay UNgated.
      * the player-hit fall-through: wrap BOTH regen lines —
          if enemy.has_fatigue():
              enemy.heal_hp(Balance.enemy_hp_regen_on_hit)
              enemy.add_fatigue(Balance.enemy_fatigue_regen_on_hit)
        Keep shake/flash/particles/reset_combo/hitstop as-is (player still got hit).
  - _resolve_player_swing():
      * idle branch becomes:
          if es == &"idle":
              var chip: float = enemy.idle_chip_multiplier()
              if chip > 0.0:
                  # Chip-through-block: reduced damage straight to HP. No combo, no
                  # riposte consume, no execute — clean punishes stay the rewarded path.
                  var base_dmg: int = Balance.hp_damage_weak if kind == &"weak" else Balance.hp_damage_strong
                  var dmg: int = int(round(float(base_dmg) * chip))
                  enemy.damage_hp(dmg)
                  score += dmg
                  _trigger_shake(SHAKE_FATIGUE)
                  _trigger_hitstop(Balance.hitstop_weak)
                  _spawn_particles(enemy.position, COLOR_CHIP, PARTICLES_CHIP)
                  return
              if kind == &"strong":
                  if enemy.has_fatigue():
                      enemy.drain_fatigue(Balance.enemy_fatigue_player_strong_idle)
                  _trigger_shake(SHAKE_FATIGUE)
                  _spawn_particles(enemy.position, COLOR_FATIGUE_FX, PARTICLES_FATIGUE)
              return
      * full-hit branch (recovery/exhausted/staggered): after enemy.damage_hp(int(round(dmg)))
        add  score += int(round(dmg))  . Everything else unchanged.
  - _update_hud(): new hud.update call per contract (game_over arg gone).
  fight.tscn:
  - Remove the [node name="Enemy" ...] block AND its ext_resource line for enemy_basic.gd
    (id "3_enemy"). Keep Player/HUD/Background untouched. Careful: text scene format.

--- hud.gd ---
  - Remove show_win var + the p_show_win param. New signature per contract; store wave,
    score, banner_ticks in new vars.
  - _on_canvas_draw():
      * Top-left readout (small, y around 36..80, font ~20, COLOR_TEXT):
          "WAVE %d" , "SCORE %d" , "MAX COMBO %d [%s]" (rank via existing _rank_for/_rank_color).
      * Keep combo+rank top-center block unchanged.
      * DELETE the whole win-overlay block (overlay rect, VYHRA, Space hint, max combo line).
      * WAVE banner: when banner_ticks > 0 draw centered "WAVE %d" (font ~72) at mid-screen,
        alpha = float(banner_ticks) / float(maxi(1, Balance.endless_banner_ticks)), color
        gold-ish Color(1.0, 0.95, 0.5, alpha). Pure fade-out.
  - Keep all existing debug text + key hints.

--- docs (gameplay.md, plan.md, sprites/SPRITES.md, CLAUDE.md, TODO.md) ---
  gameplay.md:
    - Replace the "Win condition" section with an "Endless mód" section: kill -> wave++ +
      kill bonus (endless_kill_score_per_wave * wave), immediate respawn, WAVE banner, no
      lose condition, Space restarts run anytime, combo persists across waves, score = damage
      dealt + kill bonuses. Wave composition 1-2 weak / 3-4 basic / 5+ alternating + mild
      scaling (floors, caps).
    - New "Enemy: weak (skeleton)" subsection: no fatigue (no exhausted, no regen on hitting
      player, no drains), chip-through-block table (idle hit = chip_multiplier * base, full
      dmg in recovery/staggered, threat immune; chip: no combo/riposte/execute), stats
      (hp 70, slow telegraphs, 5% strong, no feints), parry/stagger/riposte still apply.
    - Update FSM/summary notes accordingly (basic enemy unchanged).
  plan.md:
    - Architektura souborů: add enemy_weak.gd; note enemy spawns dynamically (fight.gd
      _spawn_enemy), static Enemy node removed from fight.tscn.
    - Tunable konstanty: add the enemy_weak + endless JSON blocks (values above) and bullet
      tables; document Balance.enemy_weak as a Dictionary (not flattened) and flat endless_* vars.
    - Document the capability hooks (has_fatigue / idle_chip_multiplier / max_hp /
      _sprite_sheet / _weapon_sheet / _base_tint / speed_scale / strong_prob_bonus).
    - fight.gd description: tick top = Space restart + banner; win check -> _on_enemy_defeated.
    - HUD: new update() signature, top-left wave/score/max-combo, WAVE banner, win overlay gone.
    - Verifikace: replace step 8 (Win) with endless tests: wave advance + banner, chip damage
      (no combo/riposte), weak enemy no-regen/no-fatigue-bar, composition 1-2/3-4/5+ and
      scaling floors, Space restart. Keep other steps.
  sprites/SPRITES.md:
    - Section for skeleton-basic.png (192x32, 6 cells, layout identical to enemy_basic).
      FLAG: currently a byte-identical placeholder copy of enemy_basic.png; weapon overlay
      reuses enemy_basic_weapon.png; distinguishing bony tint via _base_tint(); real skeleton
      body+weapon art TODO.
    - Document the _sprite_sheet()/_weapon_sheet() accessor refactor (the file already
      anticipates it in the extension guide) and _base_tint() in the modulate priority list
      (replaces the WHITE default at the lowest priority).
  CLAUDE.md:
    - Project structure: add enemy_weak.gd line; fight.gd line mentions wave spawning.
    - Conventions: extend the per-type overrides bullet with capability hooks (has_fatigue,
      idle_chip_multiplier, max_hp, sheet accessors, _base_tint) and Balance.enemy_weak dict
      + endless_* flats.
    - Out of scope: remove "Více typů nepřátel" (now in) and update the win/restart mention.
  TODO.md:
    - Tick off "Druhý typ nepřítele" and "Endless waves" (move to the Hotovo section with a
      short note: skeleton = fatigue-less chip enemy; endless = new default).

================ CORRECTNESS NOTES ================
  - Respawn MUST happen at the end of _on_tick (after both resolves) so fx in the same tick
    still reference the dying enemy's position. queue_free old, add_child new, rebind enemy.
  - Never call player.reset_combo() on wave advance — combo persists.
  - hp = max_hp() first line of Enemy._ready() (else spawned weak enemy starts at 100).
  - Floors guarantee telegraphs never reach 0 ticks (a 0-tick threat would fire an unfair
    same-tick swing via the defensive branch in enemy.tick()).
  - GDScript 4.x, tabs for indentation, no physics/Area2D, no AnimationPlayer.
`

const FILE_TASK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ownedFiles', 'changesSummary', 'contractConcerns', 'newSymbols', 'done'],
  properties: {
    ownedFiles: { type: 'array', items: { type: 'string' } },
    changesSummary: { type: 'string' },
    newSymbols: { type: 'array', items: { type: 'string' } },
    contractConcerns: { type: 'string', description: '"" if none' },
    done: { type: 'boolean' },
  },
}

const ASSIGNMENTS = [
  {
    key: 'enemy-hierarchy',
    files: [REPO + '/combatant.gd', REPO + '/enemy.gd', REPO + '/enemy_basic.gd', REPO + '/enemy_weak.gd'],
    task: 'Implement the combatant.gd, enemy.gd, enemy_basic.gd sections and CREATE the new enemy_weak.gd per the contract: max_hp() on Combatant + clamps; capability hooks + speed_scale/strong_prob_bonus + sprite/tint accessors + hp=max_hp() first in _ready() + fatigue-bar gate + _base_tint() in _update_sprite() on enemy.gd; scaled accessors with floors on enemy_basic.gd; the full new enemy_weak.gd file.',
  },
  {
    key: 'fight',
    files: [REPO + '/fight.gd', REPO + '/fight.tscn'],
    task: 'Implement the fight.gd + fight.tscn section: endless state (wave/score/banner_ticks, game_over removed), dynamic spawn (_ready/_advance_wave/_spawn_enemy/_on_enemy_defeated, preloads, ENEMY_SPAWN_POS), Space restart + banner decrement at top of _on_tick, has_fatigue() gates (exhausted check, parry drain only, both regen lines, strong-in-idle drain), the chip branch in the idle case, score accumulation in both damage paths, the new 13-arg hud.update call, and removal of the static Enemy node + its ext_resource from fight.tscn (text scene format — be careful).',
  },
  {
    key: 'hud',
    files: [REPO + '/hud.gd'],
    task: 'Implement the hud.gd section: new 13-arg update() signature (show_win removed; wave/score/banner_ticks added), top-left WAVE/SCORE/MAX COMBO readout, delete the win overlay block, add the fading centered WAVE banner driven by banner_ticks / Balance.endless_banner_ticks. Keep debug text, key hints, and the top-center combo+rank block unchanged.',
  },
  {
    key: 'balance',
    files: [REPO + '/balance.json', REPO + '/balance.gd'],
    task: 'Add the "enemy_weak" and "endless" sections to balance.json (exact keys/values from the spec; keep existing formatting style), and in balance.gd add var enemy_weak: Dictionary = {} (loaded as a dict, NOT flattened) plus the nine flat endless_* vars with defaults, parsed in _load_balance() with the existing int()/float() pattern.',
  },
  {
    key: 'docs',
    files: [REPO + '/gameplay.md', REPO + '/plan.md', REPO + '/sprites/SPRITES.md', REPO + '/CLAUDE.md', REPO + '/TODO.md'],
    task: 'Sync all five docs per the docs section of the spec: gameplay.md (Endless mód section replacing Win condition; weak-enemy subsection with chip table), plan.md (architecture, tunables incl. new JSON blocks, capability hooks, fight flow, HUD, verification steps), SPRITES.md (skeleton sheet + accessors + _base_tint in priority + placeholder-art flag), CLAUDE.md (structure + conventions + out-of-scope updates), TODO.md (tick off the two shipped items). Do NOT edit any .gd/.json/.tscn files. Keep values consistent with the spec defaults.',
  },
]

phase('Implement')
const results = await parallel(ASSIGNMENTS.map(a => () =>
  agent(
    'You are implementing one slice of a frozen, fully-specified feature package for an existing Godot 4.6 game. Read your assigned file(s) FIRST (read every file you own before editing), then apply EXACTLY the edits the spec assigns to your files — no more, no less. Preserve existing code style, TAB indentation, and the Czech+English comment mix. Use Edit/Write to actually modify files. Cross-file names MUST match the PUBLIC CONTRACT verbatim. Return the structured summary when done.\n\n' +
    'YOUR OWNED FILE(S): ' + a.files.join(', ') + '\n' +
    'YOUR TASK: ' + a.task + '\n\n' +
    '================ FULL SPEC ================\n' + SPEC,
    { label: 'impl:' + a.key, phase: 'Implement', schema: FILE_TASK_SCHEMA }
  ).then(r => r ? { key: a.key, ...r } : { key: a.key, failed: true })
))

return results
