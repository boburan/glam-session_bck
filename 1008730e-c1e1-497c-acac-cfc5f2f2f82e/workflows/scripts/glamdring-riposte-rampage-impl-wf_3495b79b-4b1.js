export const meta = {
  name: 'glamdring-riposte-rampage-impl',
  description: 'Implement the Riposte & Rampage combat-depth + juice package across Glamdring, one agent per disjoint file set against a frozen spec',
  phases: [
    { title: 'Implement', detail: 'parallel file-owner agents implement their file(s) against the shared spec + public contract' },
  ],
}

const REPO = 'C:\\Users\\duran\\Documents\\godot\\glamdring'

// ---------------------------------------------------------------------------
// FROZEN SPEC. No backticks anywhere. Code shown with indentation. Every cross-
// file name/signature is fixed by the PUBLIC CONTRACT section so parallel
// file-owner agents implement against identical interfaces.
// ---------------------------------------------------------------------------
const SPEC = `
GLAMDRING — "RIPOSTE & RAMPAGE" COMBAT-DEPTH + JUICE UPDATE
Game: 1v1 reaction combat, Godot 4.6, fixed 16 ticks/sec. Player invincible (v1),
goal = enemy hp to 0. All gameplay logic runs in fight.gd _on_tick(). Tunables in
balance.json via the Balance autoload. Sprites are single-cell-per-stance, swapped
via region_rect; NO animation. New visual states REUSE existing cells + a modulate
tint. Comments may mix Czech + English to match existing style.

================ THE 5 FEATURES (what we are adding) ================

F1. PERFECT PARRY -> STAGGER + RIPOSTE
  - Active parry (player blocking a WEAK enemy swing within the first
    block_active_ticks of holding block) ALREADY drains enemy fatigue. NOW it also
    ARMS A RIPOSTE on the player: player.set_riposte_ready() sets a window.
  - PERFECT PARRY = the block was started very recently (blocking_ticks_elapsed <=
    perfect_parry_ticks) at the moment the weak swing resolves. A perfect parry
    additionally STAGGERS the enemy: enemy.enter_stagger() -> new "staggered" state
    (wide-open, cannot act, all hits land), for stagger_ticks.
  - RIPOSTE: while the player's riposte window is active (riposte_ready_ticks > 0),
    the player's NEXT attack that actually DEALS DAMAGE is multiplied by
    riposte_damage_multiplier, then the riposte is consumed. A whiff (hitting an
    idle/threat enemy = no damage) does NOT consume the riposte.
  - Perfect parry is a strict subset of active parry (perfect_parry_ticks <
    block_active_ticks). Passive block (held too long) still just protects: no
    drain, no riposte (unchanged).

F2. HIT-STOP (freeze frames) -- pure presentation, gameplay-neutral
  - On impactful events, fight.gd freezes the tick loop for a few real seconds while
    still updating shake + particles + redraw. Durations (seconds, floats):
    hitstop_weak (small), hitstop_strong (big), hitstop_parry, hitstop_stagger.
  - Weak player hit -> hitstop_weak. Strong hit -> hitstop_strong. Riposte OR execute
    hit -> hitstop_strong (the bigger one). Active parry -> hitstop_parry. Perfect
    parry/stagger -> hitstop_stagger. Player getting hit -> hitstop_weak.

F3. COMBO + RANK -- feedback layer, no rule change
  - player.combo increments on every player attack that deals damage to the enemy.
    Resets to 0 when the player gets hit (enemy swing lands) OR when combo_timeout_ticks
    pass with no new damaging hit. player.max_combo tracks the session best.
  - Rank from combo: >=15 S, >=10 A, >=5 B, >=1 C, else "" (none).
  - HUD shows current combo + rank at top-center while combo >= 1, and max combo +
    rank on the win overlay.

F4. ENEMY FEINTS -- AI mind-game
  - When the enemy decides a WEAK attack, with probability feint_probability it is a
    FEINT: it telegraphs threat_weak identically to a real attack, but at the swing
    tick it does NOT swing -- instead it snaps to a short idle (feint_idle_ticks) and
    then decides again. Baits premature block/dodge. Strong attacks never feint.

F5. READABILITY TINTS + EXECUTE
  - Threat onset pulse: entering threat_weak/threat_strong sets threat_pulse_ticks
    (=THREAT_PULSE_TICKS const) so the sprite flashes bright yellow for ~2 ticks.
  - staggered state tint: cyan wash (reuses exhausted cell index 5).
  - Execute: when enemy.hp <= execute_threshold_hp, the enemy sprite gets a steady
    reddish tint, and player hits that land deal execute_damage_multiplier bonus
    damage (stacks multiplicatively with riposte; round at the end).
  - Player riposte-ready tint: while riposte_ready_ticks > 0 the player sprite gets a
    golden brightened tint.
  - Modulate priority (highest first): hit_flash > (player: riposte-ready) /
    (enemy: staggered) > threat pulse > execute > WHITE.

================ NEW balance.json KEYS + balance.gd ================

Add to balance.json (keep existing keys; add these into the named sections; add a new
"fx" section). Values below are the defaults to ship:

  "player": { ...,
    "riposte_window_ticks": 14,
    "riposte_damage_multiplier": 1.6,
    "perfect_parry_ticks": 3 },
  "enemy_basic": { ...,
    "stagger_ticks": 16,
    "feint_probability": 0.15,
    "feint_idle_ticks": 6 },
  "fight": { ...,
    "execute_threshold_hp": 25,
    "execute_damage_multiplier": 1.5,
    "combo_timeout_ticks": 48 },
  "fx": {
    "hitstop_weak": 0.04,
    "hitstop_strong": 0.10,
    "hitstop_parry": 0.08,
    "hitstop_stagger": 0.14 }

balance.gd: declare matching vars with these defaults, and parse them in _load_balance().
  Player (int unless noted):
    var riposte_window_ticks: int = 14
    var riposte_damage_multiplier: float = 1.6   (float! parse with float(...))
    var perfect_parry_ticks: int = 3
  Enemy basic:
    var stagger_ticks: int = 16
    var feint_probability: float = 0.15          (float!)
    var feint_idle_ticks: int = 6
  Fight:
    var execute_threshold_hp: int = 25
    var execute_damage_multiplier: float = 1.5   (float!)
    var combo_timeout_ticks: int = 48
  FX (new section "fx", all float seconds):
    var hitstop_weak: float = 0.04
    var hitstop_strong: float = 0.10
    var hitstop_parry: float = 0.08
    var hitstop_stagger: float = 0.14
  In _load_balance, after the existing fight block, add:
    var fx: Dictionary = data.get("fx", {}) as Dictionary
    hitstop_weak = float(fx.get("hitstop_weak", hitstop_weak))   etc.
  And add the new player/enemy_basic/fight gets alongside the existing ones in their
  blocks (use int(...) for ints, float(...) for the three multipliers/probability).

================ PUBLIC CONTRACT (exact names/signatures — DO NOT DEVIATE) ================

player.gd adds:
  var riposte_ready_ticks: int = 0
  var combo: int = 0
  var combo_timer_ticks: int = 0
  var max_combo: int = 0
  func set_riposte_ready() -> void          # riposte_ready_ticks = Balance.riposte_window_ticks; _update_sprite()
  func is_riposte_ready() -> bool           # return riposte_ready_ticks > 0
  func consume_riposte() -> void            # riposte_ready_ticks = 0; _update_sprite()
  func is_perfect_parry() -> bool           # return state == &"blocking" and blocking_ticks_elapsed <= Balance.perfect_parry_ticks
  func add_combo() -> void                  # combo += 1; max_combo = maxi(max_combo, combo); combo_timer_ticks = Balance.combo_timeout_ticks
  func reset_combo() -> void                # combo = 0; combo_timer_ticks = 0
  func combo_rank() -> StringName           # >=15 &"S", >=10 &"A", >=5 &"B", >=1 &"C", else &""

enemy.gd adds:
  func enter_stagger() -> void              # is_feint = false; set_state(&"staggered", _stagger_ticks())
  state &"staggered" handled in _advance_state_after_expiry -> _enter_idle()
  &"staggered" added to SPRITE_INDEX mapping to cell index 5 (reuse exhausted cell)
  tunable accessors (base defaults): _stagger_ticks()->int (12), _feint_probability()->float (0.0), _feint_idle_ticks()->int (6)

enemy_basic.gd adds overrides:
  func _stagger_ticks() -> int: return Balance.stagger_ticks
  func _feint_probability() -> float: return Balance.feint_probability
  func _feint_idle_ticks() -> int: return Balance.feint_idle_ticks

hud.gd update() — NEW exact signature (3 params appended):
  func update(p_enemy_hp: int, p_enemy_fatigue: int, p_enemy_state: StringName,
      p_enemy_state_ticks: int, p_player_state: StringName, p_player_state_ticks: int,
      p_dodge_cd: int, p_show_win: bool, p_combo: int, p_combo_rank: StringName,
      p_max_combo: int) -> void

fight.gd calls (must match the above exactly):
  hud.update(enemy.hp, enemy.fatigue, enemy.state, enemy.state_ticks_remaining,
      player.state, p_ticks, player.dodge_cooldown_ticks, game_over,
      player.combo, player.combo_rank(), player.max_combo)
  And: player.set_riposte_ready(), player.is_perfect_parry(), enemy.enter_stagger(),
  player.add_combo(), player.reset_combo(), player.is_riposte_ready(), player.consume_riposte()

================ PER-FILE IMPLEMENTATION DETAIL ================

--- player.gd ---
  - Add the vars + methods from the contract.
  - In tick(): after the existing cooldown decrements, also decrement riposte_ready_ticks
    if > 0 (call _update_sprite when it hits 0 is optional; it is refreshed at end of tick
    anyway). Decrement combo timer: if combo_timer_ticks > 0: combo_timer_ticks -= 1; if it
    reaches 0: combo = 0. (combo bar will refresh via HUD each tick from fight.gd.)
  - _current_visual_stance() unchanged.
  - _update_sprite(): change the modulate selection to priority:
        if hit_flash_ticks > 0: mod = SPRITE_HIT_FLASH_MODULATE
        elif riposte_ready_ticks > 0: mod = SPRITE_RIPOSTE_MODULATE
        else: mod = Color.WHITE
    Add const SPRITE_RIPOSTE_MODULATE := Color(1.6, 1.35, 0.4, 1.0)
  - Do NOT change input handling, attack/dodge logic, or existing consts otherwise.

--- enemy.gd + enemy_basic.gd ---
  enemy.gd:
  - SPRITE_INDEX: add &"staggered": 5 (reuse exhausted cell).
  - Add consts: THREAT_PULSE_TICKS := 2,
      STAGGER_MODULATE := Color(0.5, 0.85, 1.0, 1.0),
      THREAT_PULSE_MODULATE := Color(1.7, 1.5, 0.5, 1.0),
      EXECUTE_MODULATE := Color(1.35, 0.55, 0.55, 1.0)
  - Add vars: var is_feint: bool = false ; var threat_pulse_ticks: int = 0
  - tick(): at the very start (after swing_this_tick = false), decrement threat_pulse_ticks
    if > 0. Keep the rest. NOTE the defensive branch at line ~94
        elif (state == &"threat_weak" or state == &"threat_strong") and state_ticks_remaining == 0:
            swing_this_tick = true
    MUST be guarded so feints never swing: change condition to also require "and not is_feint".
  - enter_stagger() per contract.
  - _decide_attack(): after pending_attack_kind is chosen, roll feint:
        is_feint = (pending_attack_kind == &"weak" and rng.randf() < _feint_probability())
    Then set the threat state as today AND set threat_pulse_ticks = THREAT_PULSE_TICKS.
    (Strong path also sets threat_pulse_ticks.)
  - _advance_state_after_expiry():
      &"threat_weak":
          if is_feint:
              is_feint = false
              set_state(&"idle", _feint_idle_ticks())   # short feint recovery idle; re-decides on expiry
          else:
              swing_this_tick = true
              set_state(&"recovery_weak", _recovery_weak_ticks())
      &"threat_strong": unchanged (swing_this_tick = true; recovery_strong)
      add &"staggered": _enter_idle()
      keep existing idle/recovery/exhausted cases.
  - _enter_idle(): also set is_feint = false (safety) in addition to existing body.
  - Add base tunable accessors _stagger_ticks/_feint_probability/_feint_idle_ticks with the
    base defaults from the contract.
  - _update_sprite(): keep computing idx from SPRITE_INDEX.get(state, 0). Change modulate
    selection to priority:
        if hit_flash_ticks > 0: mod = SPRITE_HIT_FLASH_MODULATE
        elif state == &"staggered": mod = STAGGER_MODULATE
        elif threat_pulse_ticks > 0: mod = THREAT_PULSE_MODULATE
        elif hp <= Balance.execute_threshold_hp: mod = EXECUTE_MODULATE
        else: mod = Color.WHITE
    Apply mod to both sprite and weapon_sprite as today.
  enemy_basic.gd:
  - Add the three overrides from the contract.

--- fight.gd ---
  - Add var hitstop_timer: float = 0.0
  - Add consts: COLOR_STAGGER_FX := Color(0.5, 0.85, 1.0, 1.0)
                COLOR_RIPOSTE_FX := Color(1.0, 0.85, 0.3, 1.0)
  - _process(delta): replace the tick pump so hitstop freezes ticks:
        func _process(delta: float) -> void:
            if hitstop_timer > 0.0:
                hitstop_timer = maxf(0.0, hitstop_timer - delta)
            else:
                tick_acc += delta
                while tick_acc >= TICK_DURATION and hitstop_timer <= 0.0:
                    tick_acc -= TICK_DURATION
                    _on_tick()
            _update_shake(delta)
            _update_particles(delta)
            queue_redraw()
    (A hit inside _on_tick sets hitstop_timer > 0, which breaks the while loop and freezes
    the next ticks; tick_acc is not advanced during the freeze.)
  - Add helper: func _trigger_hitstop(amount: float) -> void: hitstop_timer = maxf(hitstop_timer, amount)
  - _resolve_enemy_swing(): keep the dodge-miss branch. Replace the weak+blocking branch:
        if kind == &"weak" and player.state == &"blocking":
            if player.is_active_block():
                enemy.drain_fatigue(Balance.enemy_fatigue_blocked_weak)
                player.set_riposte_ready()
                if player.is_perfect_parry():
                    enemy.enter_stagger()
                    _trigger_shake(SHAKE_HIT_STRONG)
                    _trigger_hitstop(Balance.hitstop_stagger)
                    _spawn_particles(_between_combatants(), COLOR_STAGGER_FX, PARTICLES_HIT_DAMAGE)
                else:
                    _trigger_shake(SHAKE_FATIGUE)
                    _trigger_hitstop(Balance.hitstop_parry)
                    _spawn_particles(_between_combatants(), COLOR_FATIGUE_FX, PARTICLES_FATIGUE)
            return
    Then the player-hit fall-through (kind strong+block, or no defense): keep existing
    regen + flash + particles + shake, and ADD: player.reset_combo() and
    _trigger_hitstop(Balance.hitstop_weak).
  - _resolve_player_swing(): threat_* unchanged (return). idle branch unchanged (strong
    drains fatigue; return). Replace the recovery/exhausted hit branch to also include
    staggered and apply riposte/execute multipliers + combo + hitstop:
        if es == &"recovery_weak" or es == &"recovery_strong" or es == &"exhausted" or es == &"staggered":
            var base_dmg: int = Balance.hp_damage_weak if kind == &"weak" else Balance.hp_damage_strong
            var dmg: float = float(base_dmg)
            var is_riposte: bool = player.is_riposte_ready()
            if is_riposte:
                dmg *= Balance.riposte_damage_multiplier
            var is_execute: bool = enemy.hp <= Balance.execute_threshold_hp
            if is_execute:
                dmg *= Balance.execute_damage_multiplier
            enemy.damage_hp(int(round(dmg)))
            if is_riposte:
                player.consume_riposte()
            player.add_combo()
            # juice
            var big: bool = is_riposte or is_execute or kind == &"strong"
            _trigger_shake(SHAKE_HIT_STRONG if big else SHAKE_HIT_WEAK)
            _trigger_hitstop(Balance.hitstop_strong if big else Balance.hitstop_weak)
            enemy.trigger_flash(Balance.hit_flash_ticks)
            var fx_col: Color = COLOR_RIPOSTE_FX if is_riposte else COLOR_HIT_DAMAGE
            _spawn_particles(enemy.position, fx_col, PARTICLES_HIT_DAMAGE)
            return
  - _update_hud(): call hud.update with the 3 new trailing args per contract.
  - game_over restart path (top of _on_tick) still calls _update_hud(); fine.

--- hud.gd ---
  - Change update() to the new 11-arg signature; store combo + rank + max_combo in new
    vars (var combo: int = 0; var combo_rank: StringName = &""; var max_combo: int = 0).
  - In _on_canvas_draw(): draw the combo at top-center when combo >= 1:
      a big number like "x{combo}" plus the rank letter, colored by rank.
      Rank colors (add consts): C = Color(0.95,0.9,0.4), B = Color(0.4,0.85,1.0),
      A = Color(1.0,0.7,0.2), S = Color(1.0,0.35,0.35). None -> dim.
      Place around y = 90, centered horizontally (VIEWPORT_W). Font sizes: combo ~46,
      rank letter ~34. Use ThemeDB.fallback_font like existing code.
  - On the win overlay, under the existing hint, add a line:
      "Max combo: {max_combo}  [{rank for max_combo}]" centered, font ~28.
      Compute the rank-for-max-combo inline with the same thresholds (or just show the
      stored combo_rank if you prefer — but max_combo rank is nicer; compute inline).
  - Keep all existing debug text + win text behavior.

--- gameplay.md + plan.md + sprites/SPRITES.md (docs owner) ---
  Sync the docs to the above. Specifically:
  gameplay.md:
    - Player section: document riposte (active parry arms riposte; next damaging hit x1.6;
      window riposte_window_ticks) and perfect parry (block started within perfect_parry_ticks
      -> enemy staggered) + the new staggered enemy state in the Enemy state table
      (staggered: stagger_ticks, wide open, all hits land, cannot act).
    - Enemy transitions: add feint branch (weak threat, feint_probability -> no swing ->
      short idle feint_idle_ticks -> re-decide) and the perfect-parry -> staggered branch.
    - Swing resolve (player): note riposte multiplier and execute multiplier
      (enemy.hp <= execute_threshold_hp -> x1.5) and that staggered counts as a hit window.
    - Add Combo & Rank section (rules + tiers). Add Execute rule.
    - Update the FSM summary diagrams (enemy: add staggered + feint; player: note riposte arm).
    - Note hit-stop + tints are polish (presentation only).
  plan.md:
    - Update the balance.json JSON block to include the new player/enemy_basic/fight keys
      and the new fx section with the shipped defaults.
    - Add the new keys to the tunable reference tables (player / enemy_basic / fight + a new
      fx group for hit-stop).
    - Polish layer: add hit-stop (freeze frames), readability tints (threat pulse, stagger
      cyan, execute red, player riposte gold).
    - HUD: note combo + rank top-center, max combo on win.
    - Enemy SPRITE_INDEX: note staggered reuses exhausted cell (idx 5) + cyan tint.
    - Add verification scenarios for: perfect parry -> stagger, riposte bonus damage, feint
      bait, combo build + reset, execute bonus under 25 HP, hit-stop freeze on strong/parry.
  sprites/SPRITES.md:
    - Add a short note: staggered (enemy) reuses cell idx 5 with cyan modulate tint; threat
      onset pulse tint; execute red tint when hp <= execute_threshold_hp; player riposte-ready
      gold tint. All modulate-only, no new cells. Document the modulate priority order.
  Keep values consistent with balance.json defaults above. Do NOT edit any .gd files.

================ CORRECTNESS NOTES ================
  - Tick order in fight._on_tick: player.tick(); enemy.tick(); player.handle_input();
    resolve enemy swing; resolve player swing; fatigue->exhausted; win check; hud.
    is_perfect_parry()/is_active_block() are evaluated at enemy-swing-resolve time, AFTER
    player.tick() (which incremented blocking_ticks_elapsed) and AFTER handle_input (which
    may have just entered blocking this tick with blocking_ticks_elapsed = 0 -> perfect).
  - riposte multiplier x execute multiplier stack; round once at the end with int(round()).
  - Damage uses Balance ints; do float math then int(round(...)).
  - Do not introduce physics/Area2D. Do not add AnimationPlayer. GDScript 4.x syntax.
`

const FILE_TASK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ownedFiles', 'changesSummary', 'contractConcerns', 'newSymbols', 'done'],
  properties: {
    ownedFiles: { type: 'array', items: { type: 'string' } },
    changesSummary: { type: 'string', description: 'concise bullet summary of edits made' },
    newSymbols: { type: 'array', items: { type: 'string' }, description: 'new vars/consts/funcs added (names)' },
    contractConcerns: { type: 'string', description: 'anything where the spec was ambiguous or a contract mismatch risk — "" if none' },
    done: { type: 'boolean', description: 'true if all assigned edits were applied' },
  },
}

const ASSIGNMENTS = [
  {
    key: 'balance',
    files: [REPO + '\\balance.json', REPO + '\\balance.gd'],
    task: 'Add all new balance keys to balance.json (new player/enemy_basic/fight keys + new "fx" section) with the shipped defaults, and declare + parse matching vars in balance.gd. Use int() for ints and float() for riposte_damage_multiplier, feint_probability, execute_damage_multiplier, and the four hitstop floats. Match the existing JSON formatting style and the existing balance.gd loader structure.',
  },
  {
    key: 'player',
    files: [REPO + '\\player.gd'],
    task: 'Implement the player.gd section: riposte/combo vars + methods (exact contract signatures), tick() decrements for riposte_ready_ticks and combo timer, the SPRITE_RIPOSTE_MODULATE const, and the _update_sprite() modulate priority. Do not change input/attack/dodge logic.',
  },
  {
    key: 'enemy',
    files: [REPO + '\\enemy.gd', REPO + '\\enemy_basic.gd'],
    task: 'Implement the enemy.gd + enemy_basic.gd section: staggered state (SPRITE_INDEX idx 5, enter_stagger, _advance_state_after_expiry case), feint logic (is_feint, _decide_attack roll, threat_weak expiry branch, guard the defensive swing branch with "and not is_feint", clear in _enter_idle), threat_pulse_ticks + the new tint consts, _update_sprite() modulate priority (hit_flash > staggered > threat pulse > execute > white), and the base + enemy_basic tunable accessors.',
  },
  {
    key: 'fight',
    files: [REPO + '\\fight.gd'],
    task: 'Implement the fight.gd section: hitstop_timer + the new _process pump that freezes ticks during hitstop, _trigger_hitstop helper, COLOR_STAGGER_FX/COLOR_RIPOSTE_FX consts, the rewritten _resolve_enemy_swing (active parry arms riposte; perfect parry staggers; player-hit resets combo + small hitstop), the rewritten _resolve_player_swing hit branch (staggered included; riposte+execute multipliers; combo; hitstop; fx), and the _update_hud call with the 3 new trailing args. Match the exact contract names.',
  },
  {
    key: 'hud',
    files: [REPO + '\\hud.gd'],
    task: 'Implement the hud.gd section: the new 11-arg update() signature + new vars (combo, combo_rank, max_combo), the top-center combo+rank draw (rank-colored, only when combo >= 1), and the max-combo line on the win overlay. Keep all existing debug/win drawing.',
  },
  {
    key: 'docs',
    files: [REPO + '\\gameplay.md', REPO + '\\plan.md', REPO + '\\sprites\\SPRITES.md'],
    task: 'Sync the docs per the spec docs section: gameplay.md (riposte/perfect-parry/stagger, feints, execute, combo+rank, updated FSM diagrams, swing resolve), plan.md (balance.json block + tunable tables + fx group, polish layer hit-stop + tints, HUD combo, staggered cell reuse, new verification scenarios), and sprites/SPRITES.md (modulate-only new visuals + priority order). Keep values consistent with the shipped defaults. Do NOT edit any .gd or .json files.',
  },
]

phase('Implement')
const results = await parallel(ASSIGNMENTS.map(a => () =>
  agent(
    'You are implementing one slice of a frozen, fully-specified feature package for an existing Godot 4.6 game. Read your assigned file(s) FIRST, then apply EXACTLY the edits the spec assigns to your file(s) — no more, no less. Preserve existing code style, indentation (tabs), and comment language (Czech+English mix is fine). Use the Edit/Write tools to actually modify the files. Cross-file names MUST match the PUBLIC CONTRACT verbatim. After editing, return your structured summary.\n\n' +
    'YOUR OWNED FILE(S): ' + a.files.join(', ') + '\n' +
    'YOUR TASK: ' + a.task + '\n\n' +
    '================ FULL SPEC ================\n' + SPEC,
    { label: 'impl:' + a.key, phase: 'Implement', schema: FILE_TASK_SCHEMA }
  ).then(r => r ? { key: a.key, ...r } : { key: a.key, failed: true })
))

return results
