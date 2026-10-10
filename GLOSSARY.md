# DailyRep

A strength-training log that plans each session, times rests between sets, and adjusts future targets so each Lifter's strength keeps increasing safely.

## Language

### People

**Lifter**:
A person with an account who owns their own Templates, Sessions and Custom Exercises, and chooses kg or lb; Lifters never see each other's data.
_Avoid_: User, athlete, member

### Planning

**Template**:
A planned workout (e.g. "Full Body A") made up of ordered Slots.
_Avoid_: Routine, plan, workout plan

**Cycle**:
A Lifter's ordered sequence of Templates (A → B → C → A…) from which the next Session's Template is suggested.
_Avoid_: Split, rotation, program

**Starter Program**:
A ready-made Cycle of Templates offered to a new Lifter, copied into their own Templates on acceptance.
_Avoid_: Default program, preset

**Exercise**:
A specific movement (e.g. "Barbell Bench Press"); either a Built-in Exercise shared by all Lifters or a Custom Exercise private to one. Progression happens per Lifter per Exercise, wherever it is performed; a heavy and a light version of a movement are separate Exercises.
_Avoid_: Lift, movement

**Bodyweight Exercise**:
An Exercise performed with the Lifter's own body as the main load (e.g. Pull-up, Dip); its recorded weight is only the load added on top, so 0 means bodyweight alone.
_Avoid_: Calisthenics, free exercise

**Reps-only Exercise**:
A Bodyweight Exercise that never takes added weight (e.g. Push-up); topping its Rep Range prompts a harder variation instead of a weight increase.
_Avoid_: Unweighted, bodyweight-only

**Per-side Exercise**:
An Exercise done one side at a time (e.g. Bulgarian Split Squat); its reps count one side, and each side gets the same reps.
_Avoid_: Unilateral, single-arm, single-leg

**Demo**:
A short looping animated illustration of how to perform a Built-in Exercise, with a few coaching cues; Custom Exercises have none.
_Avoid_: Video, tutorial, how-to

**Slot**:
An Exercise's place within a Template, specifying only how many Working Sets of it to perform there.
_Avoid_: Template exercise, entry

**Target**:
The weight and rep goal a Lifter is prescribed for an Exercise the next time they perform it.
_Avoid_: Goal, prescription

**Rep Range**:
The lower and upper rep bounds (e.g. 8–12) a Lifter sets for an Exercise, within which its Working Sets are performed.
_Avoid_: Rep scheme

**Increment**:
The smallest weight step a Lifter sets for an Exercise, by which its weight is raised or lowered.
_Avoid_: Jump, step

**Rest Period**:
The default time a Lifter rests after a Working Set of an Exercise before starting the next Set.
_Avoid_: Break, rest time

### Progression

**Double Progression**:
The rule by which reps are added at a fixed weight until every Working Set reaches the top of the Rep Range, after which the weight rises by one Increment and reps return to the bottom of the range.
_Avoid_: Auto-progression, overload

**Stall**:
An Exercise that has failed to improve its weight or its average reps per Working Set across three consecutive Sessions in which it was performed.
_Avoid_: Plateau

**Deload**:
A reduction of an Exercise's Target weight by roughly 10% triggered by a Stall, restarting at the bottom of the Rep Range.
_Avoid_: Reset, back-off

**Drop**:
An in-Session reduction of one Increment for the remaining Working Sets after a Set falls below the Rep Range; it does not change the Target.
_Avoid_: Back-off set, strip set

**Estimated 1RM**:
The heaviest single rep an Exercise is predicted to allow, derived from a Working Set's weight and reps; used to chart progress.
_Avoid_: Max, PR, e1RM

### Logging

**Session**:
One visit to the gym in which a Template is performed, possibly with Slots swapped or skipped on the day.
_Avoid_: Workout, training

**Swap**:
Performing a different Exercise in place of a Slot's Exercise for one Session; the substitute progresses as normal and the original Exercise is untouched.
_Avoid_: Substitution, replacement

**Set**:
One continuous bout of an Exercise, recorded as weight × reps achieved, plus an optional RIR.
_Avoid_: Round

**Working Set**:
A Set performed at the Target weight; the only kind of Set that counts toward progression.
_Avoid_: Main set, top set

**Warm-up Set**:
A lighter Set before the Working Sets, suggested by the app as a ramp toward the Target weight; it never affects progression.
_Avoid_: Ramp set, feeder set

**RIR (Reps in Reserve)**:
How many more reps the Lifter believes they could have done at the end of a Set; 0 means failure.
_Avoid_: RPE, effort, difficulty
