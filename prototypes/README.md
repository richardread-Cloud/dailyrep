# Prototypes

Throwaway prototypes. They hold the questions we answered and what we decided, and none of their code ships as is. Once a git repo exists, move this folder to a `prototypes` branch and keep only this README on main.

## progression-PROTOTYPE.html: does the progression logic feel right?

**Verdict (2026-10-07): accepted as is.** The rules are recorded in [ADR 0001](../docs/adr/0001-progression-per-exercise.md), along with four results that look odd but were accepted. The pure `Progression` module (the first `<script>`) is the starting point for the real progression code.

## exercise-library.js + exercise-library-PROTOTYPE.html: the Built-in Exercise library

Live copy: https://claude.ai/artifact/2ZAmTeUGnX7WFRhQMD7Lui

36 Built-in Exercises (Legs, Chest, Shoulders, Back, Arms, Core). Each has its equipment, default Rep Range, Rest Period and Increment, three rep cues, form guidance, and a Demo. The session screen loads the same file. **Keep from this:** the `LIBRARY` array is the seed data for the real Built-in Exercises. Its demo poses use a small skeleton kit (fixed limb lengths, joint angles, two-bone IK for elbows and knees) that can be lifted into the app as is.

Decided 2026-10-08: Demos stay as code-drawn figures for now. Timed holds (e.g. Plank) are left out because a Set is weight × reps. Bodyweight Exercises record added weight. Pull-ups and Dips progress by adding a belt or vest weight. Push-ups and Hanging Leg Raises are Reps-only (see ADR 0001).

Changed 2026-10-09:

- **Filled figures.** Demos are drawn as a filled body instead of a stick figure, with the limb doing the work in orange and the weights in grey. The large view also draws a dotted line along the weight's path.
- **Tempo.** A rep now plays as set up, first half, pause, second half, with the lowering half slower. Each Exercise says which half comes first (`demo.lead`) and what to call the two halves (`demo.go`, `demo.back`). While it plays, a figure fires a bubbling `figstage` event with a short label ("Lower slowly") and the index of the rep cue that applies; the large view shows the label and highlights that cue.
- **Form guidance.** Each Exercise has a `form` object: `works` (main muscles), `setup` (two or three points), `mistakes` (three fault and fix pairs) and, on Back Squat, Front Squat and Bench Press, a `safety` note. The three `cues` are kept as the rep cues and are ordered to match the Demo. This text was written from standard coaching practice and has not been checked against a published source.
- **Self-styled.** `exercise-library.js` injects the figures' CSS itself and reads four colour tokens from the page: `--ink`, `--bg`, `--line` and `--accent`. A figure on a surface other than `--bg` needs `--fig-bg` set on a parent. Pages no longer carry their own `.fig` rules.
- **Fixes.** Leg Press knees fold towards the chest, feet point away from the head on the bench exercises, the Bench Press bar touches the lower chest, and the hanging and overhead Demos use a wider frame (`demo.view`) so nothing is clipped.
- Known gap: the Back Squat arm folds in front of the chest instead of behind the bar. The side-view skeleton cannot show it properly.

## session-screen-PROTOTYPE.html: what should the in-gym Session screen look like?

Live copy: https://claude.ai/artifact/Fi4LzjFVTgD1jfjbCXA4rs

**Verdict (2026-10-07): variant D.** Variant D is A's one-set-at-a-time screen plus a toggle to B's whole-session list.

- **Current set** (default view): one large card for the next Set. It shows the weight, then **last Session's results for that Exercise** as a list (one row per Set: weight × reps, plus RIR if logged), with the row for the current set number highlighted and a note like "Same weight: beat 6 reps" or "Weight up 2.5 kg since then: aim for 6+ reps". Below that are a reps stepper (pre-filled with last time's reps at the same weight, otherwise the bottom of the Rep Range), optional RIR chips and a large Done button. Warm-up Sets come first in the same card and show the same list without a highlighted row. When a rest is running, the screen is a full-screen countdown ring with −15 s / +15 s / Skip and an "Up next" line.
- **Demo** (added 2026-10-08): a small looping animated illustration sits beside the Exercise name on the Current set card. Tapping it opens a larger version with the three rep cues (highlighted in time with the Demo), the muscles worked, set-up points and common mistakes. We chose animated illustrations over filmed clips (nothing to license or record, tiny, work offline) and over YouTube links (need signal). Built-in Exercises only for v1. The prototype draws figures from two keyframe poses per Exercise; how the real library of Demos gets produced is still open.
- **No plate breakdown anywhere** (decided 2026-10-08): the plates-per-side display was removed from both views and replaced by the last-session list. Lifters no longer enter bar or plate settings; warm-up weights are rounded to the Exercise's Increment.
- **Session N/M** tab: every Exercise with its Warm-up and Working Sets as rows, and done Sets ticked. Sets can be logged from this view too. A rest that is running shows as a slim bar fixed to the bottom. Tapping an Exercise header opens it in Current set, so Exercises can be done out of order.
- The Drop offer shows as an inline banner above the card when a Set falls below the Rep Range.
- **Opening screen** (added 2026-10-09): every time the app is opened it shows the logo, one quote about hard work and achievement, the name of today's Template with its Exercise and Set counts, and a Start session button. The quote is the same all day and changes at midnight. There's no cycling or tap-to-skip (see quotes.js below). Start session goes to the Session screen. In the prototype, tapping the logo on the Session screen brings the opening screen back.

Rejected: B on its own (too dense to use as the main view), and C (one-tap rep buttons and a clock that is always visible).

## quotes.js: the opening-screen quotes

21 quotes and `quoteForDate(date)`, loaded by the session screen. One quote per day (changed 2026-10-09 from cycling every 7 seconds): it is chosen from the Lifter's local calendar date, stays the same all day, changes at midnight, and steps through the list in order so all 21 appear before any repeats. 17 are attributed lines first published before 1929; 4 are the app's own and are attributed to "DailyRep". **Keep from this:** the `QUOTES` array is the seed data for the real opening screen. The attributed quotes were written from recall and have not been checked against their sources. Modern sports and business quotes were left out because so many are misattributed.
