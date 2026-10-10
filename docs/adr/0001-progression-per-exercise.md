# Progression is tracked per Lifter per Exercise, not per Slot

Each Lifter has one Target, Rep Range, Increment and Rest Period per Exercise, shared across every Template it appears in; a Slot only says how many Working Sets to do there. We briefly chose per-Slot progression (so the same lift could be trained heavy in one Template and light in another) but reversed it: one number per lift is simpler to reason about, and a heavy/light split is still possible as a separate Custom Exercise (e.g. "Bench Press (light)").

## Consequences

Because Slots can do different numbers of sets of the same Exercise, a Stall is judged on **average reps per Working Set**, not total reps.

The rules were validated with `prototypes/progression-PROTOTYPE.html` on 2026-10-07. These behaviours looked odd but were explicitly accepted, so don't "fix" them without revisiting this decision:

- Hitting the top of the Rep Range with RIR 0 on the last set every time still counts toward a Stall (matching your best isn't beating it), so it eventually Deloads.
- Going from fewer sets back to more can register as no progress, because later sets drag the average down.
- When ~10% rounds to no change (e.g. 8 kg with a 2 kg Increment), the Deload is forced down one full Increment, even if that's a 25% cut.
- Bodyweight Exercises progress by added weight (belt or vest) like any other Exercise. Reps-only Exercises (Push-up, Hanging Leg Raise) can't change weight. Topping the Rep Range there prompts the Lifter to raise the range or move to a harder Exercise, and a Stall shows a notice instead of a Deload. (Decided 2026-10-08.)
- Changing the Rep Range keeps the weight, so moving to a heavier range climbs one Increment per Session until it's hard enough.
