// PROTOTYPE — Built-in Exercise library with Demo figures. Shared by the prototype pages.
// The figures style themselves (see FIG_CSS below) from the page's --ink, --bg, --line and --accent tokens.
// The LIBRARY data (names, defaults, cues, poses) is the part worth lifting into the real app's seed data.
(function (global) {
  // ---------- skeleton kit: side-view figure facing right, fixed limb lengths ----------
  // Angles are degrees, counter-clockwise from "forward" (0 = forward, 90 = up, -90 = down, 180 = back).
  // Arms reach for handTo by IK, or follow armUp / armFore angles so a straight arm swings in an arc.
  const L = { shin: 19, thigh: 20, torso: 28, neck: 9, upper: 13, fore: 12, foot: 7 };
  const rad = (d) => d * Math.PI / 180;
  const v = (a, len) => [len * Math.cos(rad(a)), -len * Math.sin(rad(a))];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const lerpP = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

  // Two-bone IK: from joint S reach toward T; bend picks which side the middle joint goes (1 or -1)
  function ik(S, T, a, b, bend) {
    const dx = T[0] - S[0], dy = T[1] - S[1];
    const d = Math.min(Math.max(Math.hypot(dx, dy), 1), a + b - 0.01);
    const ang = Math.atan2(dy, dx);
    const A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
    const e = ang + bend * A;
    return [[S[0] + a * Math.cos(e), S[1] + a * Math.sin(e)], [S[0] + d * Math.cos(ang), S[1] + d * Math.sin(ang)]];
  }

  const TARGETS = ['handTo', 'hand2To', 'legTo', 'leg2To'];
  function resolve(x, P) {
    if (!x) return null;
    if (typeof x === 'string') return P[x];
    if (Array.isArray(x)) return x;
    return lerpP(resolve(x.a, P), resolve(x.b, P), x.t);
  }

  function compute(s) {
    if (s.raw) return { ...s.raw };
    const P = {};
    const legs = () => {
      const T = resolve(s.legTo, P);
      if (T) [P.knee, P.ank] = ik(P.hip, T, L.thigh, L.shin, s.legBend ?? 1);
      else { P.knee = add(P.hip, v(s.thigh, L.thigh)); P.ank = add(P.knee, v(s.shin, L.shin)); }
    };
    if (s.anchor === 'hand') {          // hanging or supported on the hands
      P.hand = s.pos; P.el = sub(P.hand, v(s.fore, L.fore)); P.sh = sub(P.el, v(s.upper, L.upper)); P.hip = sub(P.sh, v(s.torso, L.torso)); legs();
    } else if (s.anchor === 'ank') {    // standing: foot stays planted
      P.ank = s.pos; P.knee = sub(P.ank, v(s.shin, L.shin)); P.hip = sub(P.knee, v(s.thigh, L.thigh)); P.sh = add(P.hip, v(s.torso, L.torso));
    } else {                            // seated or lying: hips stay put
      P.hip = s.pos; P.sh = add(P.hip, v(s.torso, L.torso)); legs();
    }
    P.head = add(P.sh, v(s.neck ?? s.torso, L.neck));
    P.toe = add(P.ank, v(s.foot ?? 0, L.foot));
    P.backbar = add(add(P.sh, v(s.torso + 90, 5)), v(s.torso, -2));
    P.frontbar = add(add(P.sh, v(s.torso - 90, 5)), v(s.torso, -3));
    P.hang = add(P.sh, [0, 24.5]);
    if (s.fixed) Object.assign(P, s.fixed);
    if (s.anchor !== 'hand' && s.armUp !== undefined) { P.el = add(P.sh, v(s.armUp, L.upper)); P.hand = add(P.el, v(s.armFore ?? s.armUp, L.fore)); }
    else if (s.anchor !== 'hand') [P.el, P.hand] = ik(P.sh, resolve(s.handTo || 'hang', P), L.upper, L.fore, s.armBend ?? 1);
    if (s.hand2To) [P.el2, P.hand2] = ik(P.sh, resolve(s.hand2To, P), L.upper, L.fore, s.arm2Bend ?? 1);
    if (s.leg2To) [P.knee2, P.ank2] = ik(P.hip, resolve(s.leg2To, P), L.thigh, L.shin, s.leg2Bend ?? 1);
    return P;
  }

  function lerpSpec(A, B, t) {
    const out = {};
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const a = k in A ? A[k] : B[k], b = k in B ? B[k] : a;
      if (TARGETS.includes(k)) out[k] = { a, b, t };
      else if (typeof a === 'number') out[k] = a + (b - a) * t;
      else if (Array.isArray(a)) out[k] = lerpP(a, b, t);
      else if (k === 'raw' || k === 'fixed') { out[k] = {}; for (const p in a) out[k][p] = lerpP(a[p], (b && b[p]) || a[p], t); }
      else out[k] = t < .5 ? a : b;
    }
    return out;
  }


  // ---------- drawing parts ----------
  // Each part names a body segment; the renderer gives it a width, a colour role and a layer.
  const BODY = [{ l: ['sh', 'hip'], part: 'torso' }, { l: ['hip', 'knee'], part: 'thigh' }, { l: ['knee', 'ank'], part: 'shin' }, { l: ['ank', 'toe'], part: 'foot' }];
  const ARM = [{ l: ['sh', 'el'], part: 'upper' }, { l: ['el', 'hand'], part: 'fore' }, { c: 'hand', part: 'hand' }];
  const ARM2 = [{ l: ['sh', 'el2'], part: 'upper', far: 1 }, { l: ['el2', 'hand2'], part: 'fore', far: 1 }];
  const LEG2 = [{ l: ['hip', 'knee2'], part: 'thigh', far: 1 }, { l: ['knee2', 'ank2'], part: 'shin', far: 1 }];
  const HEAD = [{ l: ['sh', 'head'], part: 'neck' }, { c: 'head', part: 'head' }];
  const BAR = (p = 'hand', r = 7) => ({ c: p, r, part: 'plate' });        // barbell seen end-on: plate behind the body, bar end in front
  const DB = (p = 'hand', r = 3.5) => ({ c: p, r, part: 'weight' });      // dumbbell or roller pad, in front
  const PAD = (p, r) => ({ c: p, r, part: 'pad' });                       // machine footplate, behind
  const GRIP = (p = 'hand') => ({ c: p, r: 2.2, part: 'weight' });
  const CABLE = (from = 'pulley') => ({ l: [from, 'hand'], part: 'cable' });

  const FLOOR = '<line x1="6" y1="95" x2="94" y2="95" class="prop"/>';
  const bench = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="4" rx="1" class="prop"/><line x1="${x + 4}" y1="${y + 4}" x2="${x + 4}" y2="93" class="prop"/><line x1="${x + w - 4}" y1="${y + 4}" x2="${x + w - 4}" y2="93" class="prop"/>`;
  const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="prop"/>`;
  const column = (x) => line(x, 2, x, 93);
  const pullupBar = line(28, 12, 74, 12);

  // Front view, for movements out to the sides: raw points named l*/r* for the figure's left and right limbs.
  const FRONT = [{ l: ['neck', 'hip'], part: 'torso', w: 13 }, { l: ['ls', 'rs'], part: 'torso', w: 7 },
    { l: ['hip', 'lk'], part: 'thigh' }, { l: ['lk', 'la'], part: 'shin' }, { l: ['hip', 'rk'], part: 'thigh' }, { l: ['rk', 'ra'], part: 'shin' },
    { l: ['ls', 'lel'], part: 'upper' }, { l: ['lel', 'lha'], part: 'fore' }, { c: 'lha', part: 'hand' },
    { l: ['rs', 'rel'], part: 'upper' }, { l: ['rel', 'rha'], part: 'fore' }, { c: 'rha', part: 'hand' },
    { l: ['neck', 'head'], part: 'neck' }, { c: 'head', part: 'head' }];
  const FRONT_STAND = { head: [50, 15], neck: [50, 23], hip: [50, 55], lk: [45, 74], la: [44, 92], rk: [55, 74], ra: [56, 92], ls: [42, 26], rs: [58, 26] };

  const STAND = { anchor: 'ank', pos: [50, 92], shin: -90, thigh: -90, torso: 90 };
  const LYING = { anchor: 'hip', pos: [40, 66], torso: 0, neck: 12, thigh: 200, shin: -95, foot: 180, armBend: -1 };
  const HANG = { anchor: 'hand', pos: [50, 12], fore: 90, upper: 90, torso: 90, thigh: -90, shin: -105 };

  // ---------- the library ----------
  // equipment: barbell | dumbbell | cable | machine | bodyweight (weight = added load, 0 = bodyweight only)
  // form: the fuller how-to. works = main muscles; setup = before the first rep; mistakes = [fault, fix] pairs; safety = optional note.
  // cues: the three rep cues, in the order the Demo plays them (set up, first half, second half).
  // demo.lead: which half of the rep comes first ('lower' = start at the top, 'lift' = start at the bottom); go / back name the two halves.
  // demo.view: a wider viewBox for Demos that reach past the usual 100 x 100 frame (hanging, overhead).
  // demo.focus: the limb drawn in the accent colour (defaults to legs for the Legs group, arms otherwise).
  // repsOnly: a Bodyweight Exercise that never adds weight; topping the Rep Range prompts a harder variation instead
  // bodyweightOk: loaded, but works without any weight too, so it counts as a no-equipment alternative
  // aka: other names it goes by, matched by search
  const LIBRARY = [
    // Legs
    { id: 'back-squat', name: 'Back Squat', group: 'Legs', equipment: 'barbell', inc: 2.5, min: 5, max: 8, rest: 180,
      cues: ['Brace your core and keep your chest up.', 'Sit down between your heels until your hips are below your knees.', 'Drive up through your whole foot.'],
      form: { works: 'Quads, glutes, lower back',
        setup: ['Set the bar on the muscle of your upper back, not on your neck.', 'Grip just outside your shoulders and pull your elbows down under the bar.', 'Feet about shoulder-width, toes turned out slightly. Take a big breath and brace before each rep.'],
        mistakes: [['Knees caving in', 'Push them out in line with your toes.'], ['Heels lifting', 'Keep your weight over mid-foot. A slightly wider stance can help.'], ['Chest dropping on the way up', 'Drive your upper back into the bar so hips and chest rise together.']], safety: 'Set the safety bars just below the bottom of your squat.' },
      demo: { period: 3600, lead: 'lower', go: 'Drive up', back: 'Lower slowly', statics: FLOOR, items: [BAR('backbar'), ...BODY, ...ARM, ...HEAD],
        poses: [{ ...STAND, handTo: 'backbar', armBend: -1 }, { shin: -110, thigh: -10, torso: 60 }] } },
    { id: 'front-squat', name: 'Front Squat', group: 'Legs', equipment: 'barbell', inc: 2.5, min: 5, max: 8, rest: 180,
      cues: ['Bar rests on the front of your shoulders, elbows high.', 'Stay upright and sit straight down.', 'Drive up, keeping your elbows up.'],
      form: { works: 'Quads, glutes, upper back',
        setup: ['Rest the bar on the front of your shoulders, close to your throat, fingertips under it.', 'Lift your elbows until your upper arms are near level with the floor.', 'Feet shoulder-width, toes turned out slightly.'],
        mistakes: [['Elbows dropping', 'Drive them up as you stand so the bar stays on your shoulders.'], ['Tipping forward', 'Keep your torso tall and let your knees travel forward over your toes.'], ['Carrying the weight in your hands', 'Let your shoulders hold the bar. Your hands only steady it.']], safety: 'Squat inside a rack with the safety bars set.' },
      demo: { period: 3600, lead: 'lower', go: 'Drive up', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, BAR('frontbar')],
        poses: [{ ...STAND, handTo: 'frontbar', armBend: -1 }, { shin: -115, thigh: -5, torso: 78 }] } },
    { id: 'goblet-squat', name: 'Goblet Squat', group: 'Legs', equipment: 'dumbbell', inc: 2, min: 8, max: 12, rest: 90,
      cues: ['Hold one dumbbell upright against your chest.', 'Sit down between your heels, elbows inside your knees.', 'Stand up tall without leaning forward.'],
      form: { works: 'Quads, glutes, core',
        setup: ['Cup the top end of the dumbbell in both hands, tight against your chest.', 'Feet shoulder-width or a little wider, toes turned out.'],
        mistakes: [['Dumbbell drifting away from your chest', 'Keep it touching your breastbone throughout.'], ['Lower back rounding at the bottom', 'Stop just above the point where your pelvis tucks under.'], ['Knees caving in', 'Use your elbows to nudge them out at the bottom.']] },
      demo: { period: 3600, lead: 'lower', go: 'Stand up', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, DB('hand', 4.5)],
        poses: [{ ...STAND, handTo: 'frontbar', armBend: 1 }, { shin: -115, thigh: -5, torso: 75 }] } },
    { id: 'bodyweight-squat', name: 'Bodyweight Squat', aka: ['air squat'], group: 'Legs', equipment: 'bodyweight', repsOnly: true, inc: null, min: 15, max: 25, rest: 60,
      cues: ['Feet shoulder-width, arms out in front for balance.', 'Sit down between your heels until your hips are below your knees.', 'Stand up tall, squeezing your glutes.'],
      form: { works: 'Quads, glutes',
        setup: ['Stand with your feet shoulder-width apart, toes turned out slightly.', 'Reach your arms straight out in front of you.'],
        mistakes: [['Heels lifting', 'Keep your weight over mid-foot.'], ['Knees caving in', 'Push them out in line with your toes.'], ['Rushing', 'Take two seconds down. Hold a weight or slow down further when it gets easy.']] },
      demo: { period: 3000, lead: 'lower', go: 'Stand up', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM],
        poses: [{ ...STAND, armUp: 0, armFore: 0 }, { shin: -115, thigh: -5, torso: 72, armUp: 10, armFore: 10 }] } },
    { id: 'leg-press', name: 'Leg Press', group: 'Legs', equipment: 'machine', inc: 5, min: 10, max: 15, rest: 120,
      cues: ['Feet shoulder-width, flat on the platform.', 'Lower until your knees are near your chest, keeping your back on the pad.', 'Press back up without locking your knees hard.'],
      form: { works: 'Quads, glutes',
        setup: ['Set the seat so your hips stay down when your knees are fully bent.', 'Feet shoulder-width in the middle of the platform.', 'Hold the handles and keep your head back on the pad.'],
        mistakes: [['Hips rolling off the pad at the bottom', 'Shorten the range until your lower back stays flat.'], ['Snapping your knees straight', 'Stop just short of locked.'], ['Pushing through your toes', 'Keep your heels down and press through the whole foot.']] },
      demo: { period: 3600, lead: 'lower', go: 'Press', back: 'Lower slowly', statics: FLOOR + line(10, 56, 34, 76) + line(34, 76, 48, 76) + line(40, 76, 40, 92) + '<line x1="52" y1="62" x2="84" y2="30" class="prop rail"/>',
        items: [PAD('ank', 5), ...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'hip', pos: [36, 72], torso: 140, neck: 120, legTo: [62, 42], legBend: -1, foot: 60, handTo: [42, 76] }, { legTo: [48, 54] }] } },
    { id: 'deadlift', name: 'Deadlift', group: 'Legs', equipment: 'barbell', inc: 5, min: 4, max: 6, rest: 180,
      cues: ['Bar over mid-foot, shins close to the bar.', 'Flat back, push the floor away with your legs.', 'Stand tall, then lower it the same way.'],
      form: { works: 'Glutes, hamstrings, back, grip',
        setup: ['Stand with the bar over your mid-foot, feet hip-width.', 'Bend down and grip just outside your legs, then bring your shins to the bar.', 'Lift your chest to flatten your back and take the slack out of the bar before it leaves the floor.'],
        mistakes: [['Lower back rounding', 'Reset with your chest up. Take weight off if you cannot hold it flat.'], ['Bar drifting away from your legs', 'Keep it against your shins and thighs all the way up.'], ['Hips shooting up first', 'Push the floor away so your hips and shoulders rise together.']] },
      demo: { period: 3900, lead: 'lift', go: 'Stand up', back: 'Lower with control', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, BAR('hand', 8)],
        poses: [{ ...STAND, shin: -112, thigh: -22, torso: 32, handTo: [58, 84] }, { shin: -90, thigh: -90, torso: 90, handTo: 'hang' }] } },
    { id: 'romanian-deadlift', name: 'Romanian Deadlift', group: 'Legs', equipment: 'barbell', inc: 2.5, min: 6, max: 10, rest: 150,
      cues: ['Soft knees, bar against your thighs.', 'Push your hips back until you feel a stretch in your hamstrings.', 'Squeeze your glutes to stand back up.'],
      form: { works: 'Hamstrings, glutes, lower back',
        setup: ['Stand tall holding the bar at your thighs, hands just outside your legs.', 'Feet hip-width, knees unlocked.', 'Pull your shoulders back and brace.'],
        mistakes: [['Turning it into a squat', 'Keep your knees almost still and send your hips back.'], ['Going too low and rounding your back', 'Stop when your hips stop moving back, usually around mid-shin.'], ['Bar swinging forward', 'Slide it down your thighs and shins.']] },
      demo: { period: 3900, lead: 'lower', go: 'Stand up', back: 'Hinge back slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, BAR()],
        poses: [{ ...STAND, handTo: 'hang' }, { shin: -97, thigh: -70, torso: 22 }] } },
    { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', group: 'Legs', equipment: 'dumbbell', bodyweightOk: true, inc: 2, min: 8, max: 12, rest: 90, perSide: true,
      cues: ['Rear foot on a bench, front foot well forward.', 'Drop your back knee straight down.', 'Drive up through your front heel.'],
      form: { works: 'Quads, glutes',
        setup: ['Stand about two foot-lengths in front of a bench.', 'Rest the top of your back foot on the bench.', 'Hold the dumbbells at your sides and stand tall.'],
        mistakes: [['Front foot too close to the bench', 'Step out until your front heel stays down at the bottom.'], ['Pushing off the back leg', 'Keep most of your weight on the front foot.'], ['Front knee caving in', 'Keep it in line with your second toe.']] },
      demo: { period: 3600, lead: 'lower', go: 'Drive up', back: 'Lower slowly', statics: FLOOR + bench(14, 68, 20), items: [...LEG2, ...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ anchor: 'ank', pos: [62, 92], shin: -95, thigh: -95, torso: 88, leg2To: [26, 67], leg2Bend: -1 }, { shin: -115, thigh: -15, torso: 82 }] } },
    { id: 'walking-lunge', name: 'Walking Lunge', group: 'Legs', equipment: 'dumbbell', bodyweightOk: true, inc: 2, min: 10, max: 12, rest: 90, perSide: true,
      cues: ['Take a long step forward.', 'Lower your back knee towards the floor.', 'Push through your front foot into the next step.'],
      form: { works: 'Quads, glutes',
        setup: ['Hold the dumbbells at your sides, shoulders back.', 'Give yourself a clear path of several steps.'],
        mistakes: [['Steps too short', 'Step far enough that both knees reach about 90 degrees.'], ['Feet in one line, like a tightrope', 'Keep them hip-width apart for balance.'], ['Back knee hitting the floor', 'Lower it to just above the floor.']] },
      demo: { period: 3400, lead: 'lower', go: 'Push up', back: 'Lower slowly', statics: FLOOR, items: [...LEG2, ...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ anchor: 'ank', pos: [64, 92], shin: -100, thigh: -80, torso: 90, leg2To: [36, 92], leg2Bend: -1 }, { shin: -95, thigh: -5, torso: 88, leg2To: [34, 92] }] } },
    { id: 'forward-lunge', name: 'Forward Lunge', aka: ['front lunge'], group: 'Legs', equipment: 'dumbbell', bodyweightOk: true, inc: 2, min: 8, max: 12, rest: 90, perSide: true,
      cues: ['Stand tall, feet hip-width.', 'Step well forward and lower your back knee towards the floor.', 'Push off your front foot to step back to standing.'],
      form: { works: 'Quads, glutes',
        setup: ['Hold the dumbbells at your sides, shoulders back.', 'Stand with your feet hip-width apart.'],
        mistakes: [['Steps too short', 'Step far enough that both knees reach about 90 degrees.'], ['Front heel lifting', 'Keep your weight over the middle of your front foot.'], ['Leaning forward', 'Keep your chest up and drop straight down.']] },
      demo: { period: 3400, lead: 'lower', go: 'Push back', back: 'Step and lower', statics: FLOOR, items: [...LEG2, ...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ anchor: 'ank', pos: [44, 92], shin: -90, thigh: -90, torso: 90, leg2To: [44, 92], leg2Bend: -1 }, { pos: [70, 92], shin: -95, thigh: -5, torso: 88 }] } },
    { id: 'reverse-lunge', name: 'Reverse Lunge', aka: ['rear lunge', 'backward lunge'], group: 'Legs', equipment: 'dumbbell', bodyweightOk: true, inc: 2, min: 8, max: 12, rest: 90, perSide: true,
      cues: ['Stand tall, feet hip-width.', 'Step back and lower your back knee towards the floor.', 'Drive through your front heel to stand back up.'],
      form: { works: 'Quads, glutes',
        setup: ['Hold the dumbbells at your sides, shoulders back.', 'Stand with your feet hip-width apart.'],
        mistakes: [['Stepping back too short', 'Step far enough that both knees reach about 90 degrees.'], ['Pushing off the back foot', 'Let the front leg do the work of standing up.'], ['Front knee caving in', 'Keep it in line with your second toe.']] },
      demo: { period: 3400, lead: 'lower', go: 'Stand up', back: 'Step back and lower', statics: FLOOR, items: [...LEG2, ...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ anchor: 'ank', pos: [60, 92], shin: -90, thigh: -90, torso: 90, leg2To: [60, 92], leg2Bend: -1 }, { shin: -95, thigh: -5, torso: 88, leg2To: [30, 92] }] } },
    { id: 'hip-thrust', name: 'Hip Thrust', group: 'Legs', equipment: 'barbell', inc: 2.5, min: 8, max: 12, rest: 120,
      cues: ['Upper back on a bench, bar over your hips.', 'Drive your hips up until your body is flat from knees to shoulders.', 'Pause and squeeze, then lower.'],
      form: { works: 'Glutes, hamstrings',
        setup: ['Sit with your shoulder blades against the edge of a bench.', 'Roll the bar over your hips and use a pad.', 'Plant your feet so your shins are vertical at the top.'],
        mistakes: [['Lower back arching at the top', 'Keep your chin and ribs tucked and finish with your glutes.'], ['Feeling it mostly in your hamstrings', 'Bring your feet in closer.'], ['Rushing the top', 'Hold the squeeze for a full second.']] },
      demo: { period: 3400, lead: 'lift', go: 'Drive hips up', back: 'Lower slowly', statics: FLOOR + bench(6, 77, 24), items: [...BODY, ...HEAD, ...ARM, BAR('hip')],
        poses: [{ anchor: 'ank', pos: [70, 92], shin: -95, thigh: 30, torso: 165, neck: 150, handTo: 'hip', armBend: -1 }, { thigh: 0, torso: 180, neck: 165 }] } },
    { id: 'leg-extension', name: 'Leg Extension', group: 'Legs', equipment: 'machine', inc: 5, min: 10, max: 15, rest: 60,
      cues: ['Pad just above your ankles, back against the seat.', 'Straighten your legs fully.', 'Lower under control.'],
      form: { works: 'Quads',
        setup: ['Line your knees up with the pivot of the machine.', 'Set the back pad so your whole thigh is supported.', 'Hold the handles to keep your hips down.'],
        mistakes: [['Swinging the weight up', 'Lift smoothly and pause at the top.'], ['Hips lifting off the seat', 'Take weight off and grip the handles.'], ['Dropping the weight', 'Take two to three seconds on the way down.']] },
      demo: { period: 3100, lead: 'lift', go: 'Extend', back: 'Lower slowly', statics: FLOOR + line(26, 70, 54, 70) + line(28, 70, 31, 38) + line(40, 70, 40, 92), items: [...BODY, ...HEAD, ...ARM, DB('ank')],
        poses: [{ anchor: 'hip', pos: [40, 66], torso: 95, thigh: 0, shin: -90, handTo: [42, 70] }, { shin: -5 }] } },
    { id: 'lying-leg-curl', name: 'Lying Leg Curl', group: 'Legs', equipment: 'machine', inc: 5, min: 10, max: 15, rest: 90,
      cues: ['Lie face down, pad just above your heels.', 'Curl your heels towards your glutes.', 'Lower slowly, keeping your hips down.'],
      form: { works: 'Hamstrings',
        setup: ['Line your knees up with the pivot of the machine, just off the end of the pad.', 'Set the roller just above your heels.', 'Hold the handles and press your hips into the pad.'],
        mistakes: [['Hips lifting as you curl', 'Squeeze your glutes to keep them pinned.'], ['Short range', 'Curl as far as the pad allows and lower to nearly straight.'], ['Jerking the weight', 'Start each rep from a controlled stop.']] },
      demo: { period: 3100, lead: 'lift', go: 'Curl', back: 'Lower slowly', statics: FLOOR + bench(16, 68, 62), items: [...BODY, ...HEAD, ...ARM, DB('ank')],
        poses: [{ anchor: 'hip', pos: [48, 64], torso: 180, neck: 175, thigh: 0, shin: 0, foot: -90, handTo: [20, 70] }, { shin: 115, foot: 30 }] } },
    { id: 'standing-calf-raise', name: 'Standing Calf Raise', group: 'Legs', equipment: 'dumbbell', bodyweightOk: true, inc: 2, min: 10, max: 15, rest: 60,
      cues: ['Stand tall with the balls of your feet planted.', 'Rise as high as you can onto your toes.', 'Lower slowly to a full stretch.'],
      form: { works: 'Calves',
        setup: ['Stand with the balls of your feet on a step or plate so your heels can drop.', 'Hold the dumbbells at your sides, knees straight but not locked.'],
        mistakes: [['Bouncing', 'Pause for a second at the bottom and at the top.'], ['Half reps', 'Go from a full stretch to as high as you can.'], ['Rolling onto the outside of your feet', 'Push up through your big toe.']] },
      demo: { period: 2500, lead: 'lift', go: 'Rise', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ ...STAND, foot: 0, handTo: 'hang' }, { pos: [50, 86], foot: -38 }] } },
    { id: 'hack-squat', name: 'Hack Squat', group: 'Legs', equipment: 'machine', inc: 5, min: 8, max: 12, rest: 120,
      cues: ['Back flat on the pad, shoulders under the pads.', 'Lower until your thighs are at least level with the platform.', 'Drive up through your whole foot.'],
      form: { works: 'Quads, glutes',
        setup: ['Step onto the platform and set your back and shoulders against the pads.', 'Feet shoulder-width in the middle of the platform, toes turned out slightly.', 'Brace, then release the safety handles.'],
        mistakes: [['Heels lifting', 'Move your feet a little higher on the platform.'], ['Hips peeling off the pad at the bottom', 'Stop just above the depth where your lower back lifts.'], ['Knees caving in', 'Push them out in line with your toes.']], safety: 'Lock the safety handles back in before you step off.' },
      demo: { period: 3600, lead: 'lower', go: 'Drive up', back: 'Lower slowly', statics: FLOOR + line(38, 93, 74, 84),
        items: [...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'ank', pos: [58, 88], shin: -95, thigh: -97, torso: 104, neck: 100, handTo: 'frontbar', armBend: -1 }, { shin: -128, thigh: -8, torso: 104 }] } },
    { id: 'seated-leg-curl', name: 'Seated Leg Curl', group: 'Legs', equipment: 'machine', inc: 5, min: 10, max: 15, rest: 90,
      cues: ['Thigh pad snug, lower pad just above your heels.', 'Curl your heels down and back under the seat.', 'Let your legs straighten slowly.'],
      form: { works: 'Hamstrings',
        setup: ['Line your knees up with the pivot of the machine.', 'Set the back pad so your knees sit just off the end of the seat.', 'Lower the thigh pad until it holds your legs down firmly.'],
        mistakes: [['Hips sliding forward', 'Tighten the thigh pad and hold the handles.'], ['Short range', 'Curl until your knees are bent past 90 degrees.'], ['Letting the weight snap back', 'Take two to three seconds to straighten.']] },
      demo: { period: 3100, lead: 'lift', go: 'Curl', back: 'Return slowly', statics: FLOOR + line(26, 70, 54, 70) + line(28, 70, 31, 38) + line(40, 70, 40, 92), items: [...BODY, ...HEAD, ...ARM, DB('ank')],
        poses: [{ anchor: 'hip', pos: [40, 66], torso: 95, thigh: 0, shin: -8, handTo: [42, 70] }, { shin: -118 }] } },
    { id: 'db-romanian-deadlift', name: 'Dumbbell Romanian Deadlift', group: 'Legs', equipment: 'dumbbell', inc: 2, min: 8, max: 12, rest: 120,
      cues: ['Soft knees, dumbbells against your thighs.', 'Push your hips back until you feel a stretch in your hamstrings.', 'Squeeze your glutes to stand back up.'],
      form: { works: 'Hamstrings, glutes, lower back',
        setup: ['Stand tall holding the dumbbells in front of your thighs, palms facing you.', 'Feet hip-width, knees unlocked.', 'Pull your shoulders back and brace.'],
        mistakes: [['Turning it into a squat', 'Keep your knees almost still and send your hips back.'], ['Rounding your back to reach lower', 'Stop when your hips stop moving back.'], ['Dumbbells drifting away from your legs', 'Keep them close, brushing your thighs and shins.']] },
      demo: { period: 3900, lead: 'lower', go: 'Stand up', back: 'Hinge back slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ ...STAND, handTo: 'hang' }, { shin: -97, thigh: -70, torso: 22 }] } },
    { id: 'db-step-up', name: 'Dumbbell Step-up', group: 'Legs', equipment: 'dumbbell', bodyweightOk: true, inc: 2, min: 8, max: 12, rest: 90, perSide: true,
      cues: ['Whole front foot on the box.', 'Drive through your front heel to stand tall on the box.', 'Step down slowly with the same foot leading.'],
      form: { works: 'Quads, glutes',
        setup: ['Use a box or bench that puts your front knee at about hip height.', 'Hold the dumbbells at your sides.', 'Place your whole working foot on the box.'],
        mistakes: [['Pushing off the back foot', 'Let the back leg trail. The front leg does the lifting.'], ['Front knee caving in', 'Keep it in line with your second toe.'], ['Dropping down', 'Lower yourself under control.']] },
      demo: { period: 3600, view: '-6 -12 112 112', lead: 'lift', go: 'Step up', back: 'Step down slowly', statics: FLOOR + '<rect x="50" y="74" width="26" height="21" rx="1" class="prop"/>', items: [...LEG2, ...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ anchor: 'ank', pos: [62, 72], shin: -108, thigh: -12, torso: 78, leg2To: [42, 92], leg2Bend: -1, handTo: 'hang' }, { shin: -91, thigh: -91, torso: 90, leg2To: [54, 70] }] } },
    { id: 'glute-bridge', name: 'Glute Bridge', group: 'Legs', equipment: 'bodyweight', inc: 2.5, min: 10, max: 15, rest: 60,
      cues: ['Lie on your back, knees bent, feet flat.', 'Drive your hips up until your body is straight from knees to shoulders.', 'Squeeze for a second, then lower.'],
      form: { works: 'Glutes, hamstrings',
        setup: ['Lie on your back with your feet flat, hip-width apart, heels close to your glutes.', 'Arms by your sides, palms down.', 'Add weight by resting a plate or dumbbell across your hips.'],
        mistakes: [['Arching your lower back at the top', 'Tuck your ribs down and finish with your glutes.'], ['Feeling it in your hamstrings', 'Bring your feet closer to your glutes.'], ['Pushing through your toes', 'Drive through your heels.']] },
      demo: { period: 3200, lead: 'lift', go: 'Drive hips up', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'ank', pos: [72, 92], shin: -98, thigh: 47, torso: 180, neck: 180, handTo: [44, 92], armBend: -1 }, { thigh: 8, torso: 208, neck: 195 }] } },

    // Chest
    { id: 'bench-press', name: 'Bench Press', group: 'Chest', equipment: 'barbell', inc: 2.5, min: 5, max: 8, rest: 180,
      cues: ['Squeeze your shoulder blades together and down.', 'Lower the bar to your lower chest under control.', 'Press up and slightly back, over your shoulders.'],
      form: { works: 'Chest, front shoulders, triceps',
        setup: ['Lie with your eyes under the bar and your feet flat on the floor.', 'Grip a little wider than your shoulders, with your wrists stacked over your elbows.', 'Pinch your shoulder blades together, keep a slight arch, then unrack to straight arms over your shoulders.'],
        mistakes: [['Elbows flared straight out', 'Tuck them to about 45 to 70 degrees from your sides.'], ['Bouncing the bar off your chest', 'Touch lightly, then press.'], ['Hips lifting off the bench', 'Drive your feet into the floor and keep your glutes down.']], safety: 'Use safety arms or a spotter for heavy sets, and wrap your thumbs around the bar.' },
      demo: { period: 3400, lead: 'lower', go: 'Press', back: 'Lower slowly', statics: FLOOR + bench(30, 69, 50), items: [...BODY, ...HEAD, ...ARM, BAR()],
        poses: [{ ...LYING, handTo: [68, 42] }, { handTo: [61, 59] }] } },
    { id: 'db-bench-press', name: 'Dumbbell Bench Press', group: 'Chest', equipment: 'dumbbell', inc: 2, min: 8, max: 12, rest: 120,
      cues: ['Dumbbells over your chest, shoulder blades pinned.', 'Lower until your elbows are just below the bench.', 'Press up, bringing the dumbbells together.'],
      form: { works: 'Chest, front shoulders, triceps',
        setup: ['Sit with the dumbbells on your thighs, then lie back and bring them to your chest.', 'Feet flat, shoulder blades pinched together.', 'Start with the dumbbells over your shoulders, palms facing your feet.'],
        mistakes: [['Dumbbells drifting wide', 'Keep your forearms vertical throughout.'], ['Cutting the depth', 'Lower until the dumbbells are level with your chest.'], ['Shoulders rolling forward at the top', 'Keep your shoulder blades pinned as you press.']] },
      demo: { period: 3400, lead: 'lower', go: 'Press', back: 'Lower slowly', statics: FLOOR + bench(30, 69, 50), items: [...BODY, ...HEAD, ...ARM, DB('hand', 4)],
        poses: [{ ...LYING, handTo: [68, 41] }, { handTo: [62, 61] }] } },
    { id: 'incline-db-press', name: 'Incline Dumbbell Press', group: 'Chest', equipment: 'dumbbell', inc: 2, min: 8, max: 12, rest: 120,
      cues: ['Bench at about 30 degrees.', 'Lower the dumbbells to your upper chest.', 'Press straight up over your shoulders.'],
      form: { works: 'Upper chest, front shoulders, triceps',
        setup: ['Set the bench to about 30 degrees. Steeper shifts the work to your shoulders.', 'Kick the dumbbells up from your thighs as you lie back.', 'Feet flat, shoulder blades pinched together.'],
        mistakes: [['Elbows flared straight out', 'Tuck them slightly towards your sides.'], ['Pressing towards your face', 'Press straight up so the dumbbells finish over your shoulders.'], ['Lower back arching hard off the bench', 'Keep your ribs down and your glutes on the seat.']] },
      // Reclined facing up-left: legs come off the front of the seat to the left
      demo: { period: 3400, lead: 'lower', go: 'Press', back: 'Lower slowly', statics: FLOOR + line(42, 76, 64, 57) + line(26, 75, 46, 75) + line(40, 76, 40, 92), items: [...BODY, ...HEAD, ...ARM, DB('hand', 4)],
        poses: [{ anchor: 'hip', pos: [40, 70], torso: 40, neck: 55, thigh: 190, shin: -90, foot: 180, handTo: [62, 28], armBend: -1 }, { handTo: [64, 48] }] } },
    { id: 'chest-press-machine', name: 'Chest Press Machine', group: 'Chest', equipment: 'machine', inc: 5, min: 8, max: 12, rest: 90,
      cues: ['Handles level with your mid-chest.', 'Press forward until your arms are straight.', 'Let the handles come back slowly.'],
      form: { works: 'Chest, front shoulders, triceps',
        setup: ['Adjust the seat so the handles line up with your mid-chest.', 'Sit with your back and head against the pad, feet flat.', 'Pull your shoulder blades back before the first rep.'],
        mistakes: [['Shoulders rolling forward', 'Keep them back against the pad as you press.'], ['Elbows higher than your shoulders', 'Raise the seat.'], ['Letting the stack crash', 'Stop just before the plates touch.']] },
      demo: { period: 3100, lead: 'lift', go: 'Press', back: 'Return slowly', statics: FLOOR + line(32, 74, 32, 40) + line(30, 76, 52, 76) + line(40, 76, 40, 92) + column(78), items: [...BODY, ...HEAD, ...ARM, GRIP()],
        poses: [{ anchor: 'hip', pos: [38, 72], torso: 92, thigh: 0, shin: -90, handTo: [48, 48] }, { handTo: [62, 47] }] } },
    { id: 'dip', name: 'Dip', group: 'Chest', equipment: 'bodyweight', inc: 2.5, min: 6, max: 10, rest: 120,
      cues: ['Start with straight arms, shoulders down.', 'Lean slightly forward and lower until your elbows are at 90 degrees.', 'Press back up to straight arms.'],
      form: { works: 'Chest, triceps, front shoulders',
        setup: ['Grip the bars and step or jump up to straight arms.', 'Push your shoulders down away from your ears.', 'Bend your knees and cross your ankles if the bars are low.'],
        mistakes: [['Dropping too deep', 'Stop when your upper arms are level with the bars.'], ['Shrugging', 'Keep your shoulders down throughout.'], ['Swinging', 'Lower under control and pause before pressing.']] },
      demo: { period: 3400, lead: 'lower', go: 'Press up', back: 'Lower slowly', statics: FLOOR + line(38, 51, 76, 51) + line(72, 51, 72, 92), items: [...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'hand', pos: [52, 50], fore: -90, upper: -90, torso: 90, thigh: -100, shin: -150 }, { fore: -60, upper: -170, torso: 72 }] } },
    { id: 'push-up', name: 'Push-up', group: 'Chest', equipment: 'bodyweight', repsOnly: true, inc: null, min: 10, max: 20, rest: 60,
      cues: ['Hands under your shoulders, body in a straight line.', 'Lower your chest to just above the floor.', 'Push back up without letting your hips sag.'],
      form: { works: 'Chest, triceps, front shoulders, core',
        setup: ['Hands just wider than your shoulders, fingers pointing forward.', 'Step back onto your toes and squeeze your glutes.', 'Look at the floor just ahead of your hands.'],
        mistakes: [['Hips sagging', 'Brace your stomach and squeeze your glutes.'], ['Elbows flared straight out', 'Angle them back to about 45 degrees.'], ['Half reps', 'Chest to just above the floor, then all the way to straight arms.']] },
      demo: { period: 2800, lead: 'lower', go: 'Push up', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'hand', pos: [80, 92], fore: -90, upper: -90, torso: 15, neck: 20, thigh: 198, shin: 198, foot: -90 }, { fore: -60, upper: -150, torso: 8, neck: 12, thigh: 192, shin: 192 }] } },
    { id: 'incline-bench-press', name: 'Incline Bench Press', group: 'Chest', equipment: 'barbell', inc: 2.5, min: 6, max: 10, rest: 150,
      cues: ['Bench at about 30 degrees, shoulder blades pinned.', 'Lower the bar to your upper chest.', 'Press straight up over your shoulders.'],
      form: { works: 'Upper chest, front shoulders, triceps',
        setup: ['Set the bench to about 30 degrees and lie with your eyes just in front of the bar.', 'Grip a little wider than your shoulders.', 'Feet flat, shoulder blades pinched, then unrack to straight arms.'],
        mistakes: [['Bar landing on your neck or mid-chest', 'Touch just below your collarbones.'], ['Elbows flared straight out', 'Tuck them slightly towards your sides.'], ['Hips lifting off the seat', 'Keep your glutes down and drive through your feet.']], safety: 'Use safety arms or a spotter for heavy sets.' },
      demo: { period: 3400, lead: 'lower', go: 'Press', back: 'Lower slowly', statics: FLOOR + line(42, 76, 64, 57) + line(26, 75, 46, 75) + line(40, 76, 40, 92), items: [...BODY, ...HEAD, ...ARM, BAR()],
        poses: [{ anchor: 'hip', pos: [40, 70], torso: 40, neck: 55, thigh: 190, shin: -90, foot: 180, handTo: [61, 27], armBend: -1 }, { handTo: [54, 51] }] } },
    { id: 'db-fly', name: 'Dumbbell Fly', group: 'Chest', equipment: 'dumbbell', inc: 2, min: 10, max: 15, rest: 90,
      cues: ['Dumbbells over your chest, palms facing, elbows soft.', 'Open your arms wide until you feel a stretch across your chest.', 'Hug them back together over your chest.'],
      form: { works: 'Chest, front shoulders',
        setup: ['Lie on a flat bench with the dumbbells pressed up over your chest, palms facing each other.', 'Bend your elbows slightly and keep that bend the whole set.', 'Feet flat, shoulder blades pinched together.'],
        mistakes: [['Bending your elbows more as you lower', 'Keep the same slight bend. Otherwise it turns into a press.'], ['Lowering too far', 'Stop when your elbows are level with the bench.'], ['Going heavy', 'Pick a weight you can control at the bottom of the stretch.']] },
      // Seen from the feet: the bench end-on, the arms sweeping out to the sides
      demo: { period: 3400, trail: false, lead: 'lower', go: 'Bring together', back: 'Open slowly', statics: FLOOR + '<rect x="42" y="72" width="16" height="21" rx="1" class="prop"/>',
        items: [{ l: ['hip', 'lk'], part: 'thigh' }, { l: ['lk', 'la'], part: 'shin' }, { l: ['hip2', 'rk'], part: 'thigh' }, { l: ['rk', 'ra'], part: 'shin' },
          { l: ['ls', 'rs'], part: 'torso', w: 13 }, { c: 'head', part: 'head' },
          { l: ['ls', 'lel'], part: 'upper' }, { l: ['lel', 'lha'], part: 'fore' }, { c: 'lha', part: 'hand' },
          { l: ['rs', 'rel'], part: 'upper' }, { l: ['rel', 'rha'], part: 'fore' }, { c: 'rha', part: 'hand' }, DB('lha'), DB('rha')],
        poses: [{ raw: { head: [50, 57], ls: [40, 66], rs: [60, 66], hip: [45, 70], hip2: [55, 70], lk: [36, 74], la: [33, 93], rk: [64, 74], ra: [67, 93],
          lel: [43, 48], lha: [47, 34], rel: [57, 48], rha: [53, 34] } },
          { raw: { lel: [25, 60], lha: [12, 64], rel: [75, 60], rha: [88, 64] } }] } },
    { id: 'cable-crossover', name: 'Cable Crossover', group: 'Chest', equipment: 'cable', inc: 2.5, min: 10, max: 15, rest: 60,
      cues: ['Handles high, one foot forward, slight lean.', 'Sweep your hands down and together in front of your hips.', 'Let your arms open back up until you feel the stretch.'],
      form: { works: 'Chest, front shoulders',
        setup: ['Set both pulleys above head height.', 'Take a handle in each hand and step forward into a split stance.', 'Lean forward slightly with a soft bend in your elbows.'],
        mistakes: [['Pressing instead of hugging', 'Keep the elbow bend fixed and move from the shoulder.'], ['Shoulders rolling forward', 'Keep your chest up as your hands meet.'], ['Letting the stack pull you back', 'Use less weight and stay still.']] },
      demo: { period: 3400, trail: false, lead: 'lift', go: 'Bring together', back: 'Open slowly', statics: FLOOR + column(4) + column(96),
        items: [{ l: ['pl', 'lha'], part: 'cable' }, { l: ['pr', 'rha'], part: 'cable' }, ...FRONT, GRIP('lha'), GRIP('rha')],
        poses: [{ raw: { ...FRONT_STAND, pl: [4, 8], pr: [96, 8], lel: [27, 22], lha: [15, 14], rel: [73, 22], rha: [85, 14] } },
          { raw: { lel: [38, 44], lha: [48, 54], rel: [62, 44], rha: [52, 54] } }] } },
    { id: 'pec-deck', name: 'Pec Deck', group: 'Chest', equipment: 'machine', inc: 5, min: 10, max: 15, rest: 60,
      cues: ['Back flat on the pad, handles at chest height.', 'Squeeze your arms together in front of your chest.', 'Open slowly until you feel the stretch.'],
      form: { works: 'Chest, front shoulders',
        setup: ['Set the seat so the handles are level with your mid-chest.', 'Sit with your back and head against the pad.', 'Hold the handles with a slight bend in your elbows.'],
        mistakes: [['Shoulders rolling forward as you squeeze', 'Keep your shoulder blades back against the pad.'], ['Letting the arms fly back', 'Stop at a comfortable stretch, just behind your body.'], ['Bouncing out of the stretch', 'Pause before each squeeze.']] },
      demo: { period: 3200, trail: false, lead: 'lift', go: 'Squeeze', back: 'Open slowly', statics: FLOOR + '<rect x="40" y="20" width="20" height="50" rx="3" class="prop"/>' + line(50, 70, 50, 93),
        items: [...FRONT, GRIP('lha'), GRIP('rha')],
        poses: [{ raw: { head: [50, 22], neck: [50, 30], hip: [50, 64], ls: [42, 34], rs: [58, 34], lk: [42, 76], la: [41, 93], rk: [58, 76], ra: [59, 93],
          lel: [24, 36], lha: [16, 26], rel: [76, 36], rha: [84, 26] } },
          { raw: { lel: [36, 42], lha: [47, 36], rel: [64, 42], rha: [53, 36] } }] } },

    // Shoulders
    { id: 'overhead-press', name: 'Overhead Press', group: 'Shoulders', equipment: 'barbell', inc: 2.5, min: 5, max: 8, rest: 150,
      cues: ['Bar on the front of your shoulders, glutes squeezed.', 'Press straight up, moving your head back out of the way.', 'Finish with the bar over your mid-foot.'],
      form: { works: 'Front shoulders, side shoulders, triceps, upper chest',
        setup: ['Take the bar from a rack at chest height, hands just outside your shoulders.', 'Elbows slightly in front of the bar, forearms vertical.', 'Feet hip-width. Squeeze your glutes and brace.'],
        mistakes: [['Leaning back', 'Squeeze your glutes and keep your ribs down.'], ['Pressing around your face', 'Tuck your chin back, then bring your head through once the bar passes.'], ['Using your legs', 'Keep your knees locked. Bending them makes it a push press.']] },
      demo: { period: 3400, view: '-6 -11 112 112', lead: 'lift', go: 'Press', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, BAR()],
        poses: [{ ...STAND, handTo: 'frontbar', armBend: -1 }, { handTo: [52, 1] }] } },
    { id: 'seated-db-shoulder-press', name: 'Seated Dumbbell Shoulder Press', group: 'Shoulders', equipment: 'dumbbell', inc: 2, min: 8, max: 12, rest: 90,
      cues: ['Sit tall with your back against the pad, dumbbells at ear height.', 'Press up until your arms are straight.', 'Lower slowly back to ear height.'],
      form: { works: 'Front shoulders, side shoulders, triceps',
        setup: ['Set the back pad almost upright.', 'Kick the dumbbells up from your thighs to shoulder height.', 'Elbows slightly in front of your body, not straight out to the sides.'],
        mistakes: [['Arching away from the pad', 'Keep your lower back and head against it.'], ['Stopping short', 'Lower until the dumbbells are about ear height.'], ['Dumbbells drifting forward', 'Finish with them over your shoulders.']] },
      demo: { period: 3100, lead: 'lift', go: 'Press', back: 'Lower slowly', statics: FLOOR + line(32, 76, 56, 76) + line(40, 76, 40, 92) + line(38, 76, 38, 36), items: [...BODY, ...HEAD, ...ARM, DB('hand', 4)],
        poses: [{ anchor: 'hip', pos: [44, 72], torso: 90, thigh: 0, shin: -90, handTo: [50, 38], armBend: -1 }, { handTo: [47, 20] }] } },
    { id: 'db-lateral-raise', name: 'Dumbbell Lateral Raise', group: 'Shoulders', equipment: 'dumbbell', inc: 2, min: 10, max: 15, rest: 60,
      cues: ['Keep a slight bend in your elbows.', 'Raise the dumbbells out to the side, up to shoulder height.', 'Lower slowly. Don\'t swing.'],
      form: { works: 'Side shoulders',
        setup: ['Stand tall with the dumbbells at your sides.', 'Lean forward very slightly from the hips.', 'Pick a weight you can lift without swinging. It will be lighter than you expect.'],
        mistakes: [['Shrugging', 'Think of pushing the dumbbells out to the walls, not up.'], ['Swinging from the hips', 'Stay still, or take weight off.'], ['Lifting above shoulder height', 'Stop when your arms are level with the floor.']] },
      demo: { period: 3400, trail: false, lead: 'lift', go: 'Raise', back: 'Lower slowly', statics: FLOOR,
        items: [...FRONT, DB('lha'), DB('rha')],
        poses: [{ raw: { ...FRONT_STAND, lel: [40, 40], lha: [40, 52], rel: [60, 40], rha: [60, 52] } },
          { raw: { lel: [30, 28], lha: [18, 30], rel: [70, 28], rha: [82, 30] } }] } },
    { id: 'face-pull', name: 'Face Pull', group: 'Shoulders', equipment: 'cable', inc: 2.5, min: 12, max: 20, rest: 60,
      cues: ['Rope at face height, arms straight.', 'Pull the rope towards your forehead, elbows high.', 'Squeeze your upper back, then return slowly.'],
      form: { works: 'Rear shoulders, upper back',
        setup: ['Set the pulley at about face height with a rope.', 'Hold the rope with your thumbs towards you and step back until the weight lifts.', 'Stand with one foot slightly back for balance.'],
        mistakes: [['Leaning back to move the weight', 'Stay upright and use less weight.'], ['Elbows dropping', 'Keep them level with your shoulders.'], ['Pulling to your chest', 'Pull to your forehead and spread the rope apart.']] },
      demo: { period: 3100, lead: 'lift', go: 'Pull', back: 'Return slowly', statics: FLOOR + column(92), items: [CABLE(), ...BODY, ...HEAD, ...ARM, GRIP()],
        poses: [{ ...STAND, fixed: { pulley: [90, 20] }, handTo: [73, 22], armBend: -1 }, { handTo: [57, 15] }] } },
    { id: 'arnold-press', name: 'Arnold Press', group: 'Shoulders', equipment: 'dumbbell', inc: 2, min: 8, max: 12, rest: 90,
      cues: ['Dumbbells in front of your chin, palms facing you.', 'Turn your palms forward as you press overhead.', 'Turn them back towards you as you lower.'],
      form: { works: 'Front shoulders, side shoulders, triceps',
        setup: ['Sit on a bench with the back pad almost upright.', 'Hold the dumbbells in front of your chin, palms facing you, elbows in front.', 'Brace and keep your back against the pad.'],
        mistakes: [['Rushing the turn', 'Rotate smoothly through the whole press.'], ['Arching away from the pad', 'Keep your ribs down and your back on the pad.'], ['Stopping short at the top', 'Finish with straight arms over your shoulders.']] },
      demo: { period: 3400, lead: 'lift', go: 'Press and turn', back: 'Lower and turn back', statics: FLOOR + line(32, 76, 56, 76) + line(40, 76, 40, 92) + line(38, 76, 38, 36), items: [...BODY, ...HEAD, ...ARM, DB('hand', 4)],
        poses: [{ anchor: 'hip', pos: [44, 72], torso: 90, thigh: 0, shin: -90, handTo: [55, 36], armBend: -1 }, { handTo: [47, 20] }] } },
    { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', group: 'Shoulders', equipment: 'machine', inc: 5, min: 8, max: 12, rest: 90,
      cues: ['Handles at shoulder height, back on the pad.', 'Press up until your arms are straight.', 'Lower slowly back to shoulder height.'],
      form: { works: 'Front shoulders, side shoulders, triceps',
        setup: ['Set the seat so the handles start level with your shoulders.', 'Sit with your back and head against the pad, feet flat.', 'Grip the handles with your wrists stacked over your elbows.'],
        mistakes: [['Arching away from the pad', 'Keep your lower back against it.'], ['Shrugging as you press', 'Keep your shoulders down away from your ears.'], ['Letting the stack crash', 'Stop just before the plates touch.']] },
      demo: { period: 3100, lead: 'lift', go: 'Press', back: 'Lower slowly', statics: FLOOR + line(32, 76, 56, 76) + line(40, 76, 40, 92) + line(38, 76, 38, 30) + column(78), items: [...BODY, ...HEAD, ...ARM, GRIP()],
        poses: [{ anchor: 'hip', pos: [44, 72], torso: 90, thigh: 0, shin: -90, handTo: [52, 37], armBend: -1 }, { handTo: [50, 19] }] } },
    { id: 'pike-push-up', name: 'Pike Push-up', group: 'Shoulders', equipment: 'bodyweight', repsOnly: true, inc: null, min: 6, max: 12, rest: 90,
      cues: ['Hips high, body in an upside-down V.', 'Bend your elbows to lower the top of your head towards the floor.', 'Press back up to straight arms.'],
      form: { works: 'Front shoulders, triceps',
        setup: ['Start in a push-up position, then walk your feet in and lift your hips high.', 'Hands just wider than your shoulders.', 'Look back towards your feet so your head stays in line with your arms.'],
        mistakes: [['Hips dropping', 'Keep them stacked high over your shoulders.'], ['Elbows flaring wide', 'Point them back at about 45 degrees.'], ['Too easy', 'Put your feet up on a bench.']] },
      demo: { period: 3000, lead: 'lower', go: 'Press up', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'ank', pos: [22, 92], shin: -105, thigh: -105, foot: 0, torso: -25, neck: -40, handTo: [62, 92], armBend: -1 }, { torso: -45, neck: -72 }] } },
    { id: 'db-front-raise', name: 'Dumbbell Front Raise', group: 'Shoulders', equipment: 'dumbbell', inc: 2, min: 10, max: 15, rest: 60,
      cues: ['Dumbbells in front of your thighs, elbows soft.', 'Raise them straight in front of you to shoulder height.', 'Lower slowly. Don\'t swing.'],
      form: { works: 'Front shoulders',
        setup: ['Stand tall with the dumbbells in front of your thighs, palms facing you.', 'Keep a slight bend in your elbows.', 'Brace so your torso stays still.'],
        mistakes: [['Swinging from the hips', 'Stay still, or take weight off.'], ['Raising above shoulder height', 'Stop when your arms are level with the floor.'], ['Shrugging', 'Keep your shoulders down.']] },
      demo: { period: 3200, lead: 'lift', go: 'Raise', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ ...STAND, armUp: -80, armFore: -74 }, { armUp: 0, armFore: 6 }] } },
    { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', group: 'Shoulders', equipment: 'cable', inc: 2.5, min: 12, max: 15, rest: 60, perSide: true,
      cues: ['Stand side-on to a low pulley, handle in your far hand.', 'Raise your arm out to the side, up to shoulder height.', 'Lower slowly across your body.'],
      form: { works: 'Side shoulders',
        setup: ['Set the pulley at its lowest point.', 'Stand side-on to it and take the handle in the hand furthest from the machine.', 'Hold the machine with your other hand and lean away slightly.'],
        mistakes: [['Shrugging', 'Push the handle out to the wall, not up.'], ['Leaning to swing it up', 'Stay still and use less weight.'], ['Bending your elbow more and more', 'Keep the same slight bend throughout.']] },
      demo: { period: 3400, trail: false, lead: 'lift', go: 'Raise', back: 'Lower slowly', statics: FLOOR + line(8, 30, 8, 93),
        items: [{ l: ['pl', 'rha'], part: 'cable' }, ...FRONT, GRIP('rha')],
        poses: [{ raw: { ...FRONT_STAND, pl: [8, 88], lel: [36, 38], lha: [30, 48], rel: [58, 41], rha: [50, 54] } },
          { raw: { rel: [70, 28], rha: [83, 31] } }] } },

    // Back
    { id: 'barbell-row', name: 'Barbell Row', group: 'Back', equipment: 'barbell', inc: 2.5, min: 6, max: 10, rest: 120,
      cues: ['Hinge at the hips with a flat back and soft knees.', 'Pull the bar to your lower ribs.', 'Lower it slowly without standing up.'],
      form: { works: 'Lats, upper back, rear shoulders',
        setup: ['Stand with the bar over your mid-foot, feet hip-width.', 'Hinge until your torso is somewhere between level and 45 degrees.', 'Grip just outside your knees and let your arms hang straight.'],
        mistakes: [['Standing up as you pull', 'Hold your torso angle. Take weight off if you cannot.'], ['Back rounding', 'Lift your chest and brace before each rep.'], ['Yanking with your arms', 'Lead with your elbows and squeeze your shoulder blades together.']] },
      demo: { period: 3100, lead: 'lift', go: 'Pull', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, BAR()],
        poses: [{ anchor: 'ank', pos: [45, 92], shin: -100, thigh: -60, torso: 20, neck: 30, handTo: 'hang' }, { handTo: [57, 56] }] } },
    { id: 'one-arm-db-row', name: 'One-arm Dumbbell Row', group: 'Back', equipment: 'dumbbell', inc: 2, min: 8, max: 12, rest: 90, perSide: true,
      cues: ['One hand on a bench, back flat.', 'Pull the dumbbell to your hip, elbow close to your side.', 'Lower to a full stretch.'],
      form: { works: 'Lats, upper back',
        setup: ['Place one hand on a bench with that arm straight.', 'Step your feet back and apart so your back is flat and nearly level.', 'Let the dumbbell hang straight below your shoulder.'],
        mistakes: [['Twisting your torso open', 'Keep your shoulders square to the floor.'], ['Pulling to your chest', 'Pull back towards your hip.'], ['Shrugging the weight up', 'Start each rep by drawing your shoulder blade back.']] },
      demo: { period: 3100, lead: 'lift', go: 'Pull', back: 'Lower slowly', statics: FLOOR + bench(66, 67, 26), items: [...ARM2, ...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ anchor: 'ank', pos: [38, 92], shin: -92, thigh: -80, torso: 12, neck: 20, hand2To: [76, 66], arm2Bend: -1, handTo: 'hang' }, { handTo: [56, 52] }] } },
    { id: 'seated-cable-row', name: 'Seated Cable Row', group: 'Back', equipment: 'cable', inc: 2.5, min: 8, max: 12, rest: 90,
      cues: ['Sit tall with your knees slightly bent.', 'Pull the handle to your stomach, squeezing your shoulder blades.', 'Let your arms straighten without rounding forward.'],
      form: { works: 'Lats, upper back, biceps',
        setup: ['Sit with your feet on the plates and your knees slightly bent.', 'Take the handle and slide back until your arms are straight and the weight is lifted.', 'Sit tall with your chest up.'],
        mistakes: [['Rocking back and forth', 'Keep your torso nearly upright and let your arms and shoulder blades do the work.'], ['Lower back rounding on the return', 'Reach with your shoulders, not your spine.'], ['Shrugging', 'Keep your shoulders down as you pull.']] },
      demo: { period: 3400, lead: 'lift', go: 'Pull', back: 'Return slowly', statics: FLOOR + line(22, 80, 48, 80) + line(84, 64, 84, 88) + column(94), items: [CABLE(), ...BODY, ...HEAD, ...ARM, GRIP()],
        poses: [{ anchor: 'hip', pos: [36, 77], torso: 75, thigh: 4, shin: -6, foot: 80, fixed: { pulley: [92, 66] }, handTo: [74, 62] }, { torso: 92, handTo: [50, 62] }] } },
    { id: 'lat-pulldown', name: 'Lat Pulldown', group: 'Back', equipment: 'cable', inc: 2.5, min: 8, max: 12, rest: 90,
      cues: ['Thighs under the pad, hands just wider than your shoulders.', 'Pull the bar to your upper chest, leaning back slightly.', 'Let it rise until your arms are straight.'],
      form: { works: 'Lats, biceps',
        setup: ['Set the thigh pad snug so you cannot lift off the seat.', 'Stand to take the bar, then sit down with it.', 'Grip just wider than your shoulders, palms facing away.'],
        mistakes: [['Leaning far back and heaving', 'Lean back only slightly and keep still.'], ['Pulling behind your neck', 'Bring the bar to your upper chest.'], ['Pulling with your hands', 'Think of driving your elbows down towards your back pockets.']] },
      demo: { period: 3400, lead: 'lift', go: 'Pull down', back: 'Return slowly', statics: FLOOR + line(32, 78, 56, 78) + line(44, 78, 44, 92) + line(58, 67, 70, 67), items: [CABLE(), ...BODY, ...HEAD, ...ARM, GRIP()],
        poses: [{ anchor: 'hip', pos: [44, 75], torso: 100, thigh: 0, shin: -90, fixed: { pulley: [52, 0] }, handTo: [52, 18] }, { handTo: [48, 47] }] } },
    { id: 'pull-up', name: 'Pull-up', group: 'Back', equipment: 'bodyweight', inc: 2.5, min: 5, max: 8, rest: 120,
      cues: ['Hands just wider than your shoulders, palms facing away.', 'Pull until your chin is over the bar.', 'Lower all the way to straight arms.'],
      form: { works: 'Lats, biceps, upper back',
        setup: ['Grip just wider than your shoulders, palms facing away.', 'Hang with straight arms, then pull your shoulders down away from your ears.', 'Squeeze your glutes and keep your legs still.'],
        mistakes: [['Swinging or kipping', 'Start each rep from a dead hang.'], ['Half reps', 'Chin over the bar, then all the way down.'], ['Craning your chin to the bar', 'Lead with your chest and keep your neck relaxed.']] },
      demo: { period: 3600, view: '-7 0 114 114', lead: 'lift', go: 'Pull up', back: 'Lower slowly', statics: pullupBar, items: [...BODY, ...HEAD, ...ARM],
        poses: [{ ...HANG }, { fore: 60, upper: 200, torso: 82, thigh: -80, shin: -115 }] } },
    { id: 'chin-up', name: 'Chin-up', group: 'Back', equipment: 'bodyweight', inc: 2.5, min: 5, max: 8, rest: 120,
      cues: ['Hands shoulder-width, palms facing you.', 'Pull until your chin is over the bar.', 'Lower all the way to straight arms.'],
      form: { works: 'Lats, biceps',
        setup: ['Grip shoulder-width, palms facing you.', 'Hang with straight arms, then pull your shoulders down away from your ears.', 'Squeeze your glutes and keep your legs still.'],
        mistakes: [['Swinging', 'Start each rep from a dead hang.'], ['Stopping short at the bottom', 'Lower to straight arms every rep.'], ['Elbows flaring out', 'Keep them in front of you and pull them down to your ribs.']] },
      demo: { period: 3600, view: '-7 0 114 114', lead: 'lift', go: 'Pull up', back: 'Lower slowly', statics: pullupBar, items: [...BODY, ...HEAD, ...ARM],
        poses: [{ ...HANG }, { fore: 60, upper: 200, torso: 82, thigh: -80, shin: -115 }] } },
    { id: 'inverted-row', name: 'Inverted Row', group: 'Back', equipment: 'bodyweight', inc: 2.5, min: 8, max: 12, rest: 90,
      cues: ['Hang under the bar, body straight from heels to head.', 'Pull your chest to the bar.', 'Lower to straight arms without letting your hips sag.'],
      form: { works: 'Lats, upper back, biceps, rear shoulders',
        setup: ['Set a bar in a rack at about waist height.', 'Lie under it and grip just wider than your shoulders.', 'Heels on the floor, glutes squeezed so your body is one straight line.'],
        mistakes: [['Hips sagging', 'Squeeze your glutes and brace your stomach.'], ['Reaching with your chin', 'Lead with your chest.'], ['Too hard or too easy', 'Raise the bar to make it easier, lower it or raise your feet to make it harder.']] },
      demo: { period: 3200, lead: 'lift', go: 'Pull', back: 'Lower slowly', statics: FLOOR + line(84, 44, 84, 93) + '<circle cx="78" cy="44" r="2.6" class="prop"/>', items: [...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'ank', pos: [12, 91], shin: 200, thigh: 200, torso: 20, neck: 20, foot: 75, handTo: [78, 45], armBend: -1 }, { shin: 213, thigh: 213, torso: 33, neck: 40 }] } },
    { id: 'chest-supported-db-row', name: 'Chest-supported Dumbbell Row', group: 'Back', equipment: 'dumbbell', inc: 2, min: 8, max: 12, rest: 90,
      cues: ['Chest on an incline bench, arms hanging straight.', 'Pull the dumbbells back towards your hips.', 'Lower to a full stretch.'],
      form: { works: 'Upper back, lats, rear shoulders',
        setup: ['Set a bench to about 30 to 45 degrees.', 'Lie face down with your chest on the pad and your feet on the floor.', 'Let the dumbbells hang straight below your shoulders.'],
        mistakes: [['Lifting your chest off the pad', 'Keep it pressed down. The pad stops you cheating.'], ['Shrugging the weight up', 'Draw your shoulder blades back and down first.'], ['Cutting the stretch short', 'Let your arms straighten fully each rep.']] },
      demo: { period: 3100, lead: 'lift', go: 'Pull', back: 'Lower slowly', statics: FLOOR + line(36, 74, 62, 50) + line(46, 66, 46, 93), items: [...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ anchor: 'hip', pos: [34, 68], torso: 40, neck: 45, legTo: [16, 92], legBend: 1, foot: 0, handTo: 'hang' }, { handTo: [50, 62] }] } },
    { id: 'straight-arm-pulldown', name: 'Straight-arm Pulldown', group: 'Back', equipment: 'cable', inc: 2.5, min: 10, max: 15, rest: 60,
      cues: ['Arms straight, hands at head height, slight lean.', 'Sweep the bar down to your thighs, keeping your arms straight.', 'Let it rise back up slowly.'],
      form: { works: 'Lats',
        setup: ['Set a bar or rope on a high pulley.', 'Step back, hinge forward slightly and take it with straight arms.', 'Keep a soft bend in your elbows and your chest up.'],
        mistakes: [['Bending your elbows to push down', 'Keep them fixed. The movement comes from your shoulders.'], ['Leaning your bodyweight onto it', 'Hold your torso still and use less weight.'], ['Shrugging at the top', 'Keep your shoulders down as the bar rises.']] },
      demo: { period: 3100, lead: 'lift', go: 'Pull down', back: 'Return slowly', statics: FLOOR + column(90), items: [CABLE(), ...BODY, ...HEAD, ...ARM, GRIP()],
        poses: [{ ...STAND, pos: [44, 92], thigh: -84, torso: 74, fixed: { pulley: [88, 6] }, armUp: 22, armFore: 16 }, { armUp: -74, armFore: -80 }] } },
    { id: 'back-extension', name: 'Back Extension', group: 'Back', equipment: 'bodyweight', inc: 2.5, min: 10, max: 15, rest: 60,
      cues: ['Hips on the pad, body in a straight line.', 'Lower your chest towards the floor with a flat back.', 'Squeeze your glutes to come back up level with your legs.'],
      form: { works: 'Lower back, glutes, hamstrings',
        setup: ['Set the pad so it sits just below your hip bones.', 'Hook your heels under the foot pads.', 'Cross your arms over your chest. Hold a plate there to add weight.'],
        mistakes: [['Arching past straight at the top', 'Stop when your body is in one line.'], ['Rounding hard at the bottom', 'Keep your back flat and hinge from the hips.'], ['Swinging up', 'Rise smoothly and pause at the top.']] },
      demo: { period: 3400, lead: 'lower', go: 'Rise', back: 'Lower slowly', focus: 'torso', statics: FLOOR + line(54, 58, 68, 93) + line(18, 74, 34, 93),
        items: [PAD('pad', 4.5), PAD('heel', 3), ...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'hip', pos: [50, 50], thigh: 225, shin: 225, foot: -40, torso: 45, neck: 45, fixed: { pad: [55, 55], heel: [20, 77] }, handTo: 'frontbar', armBend: -1 },
          { torso: -50, neck: -60 }] } },

    // Arms
    { id: 'barbell-curl', name: 'Barbell Curl', group: 'Arms', equipment: 'barbell', inc: 2.5, min: 8, max: 12, rest: 60,
      cues: ['Elbows pinned to your sides.', 'Curl the bar up to your shoulders.', 'Lower slowly. Don\'t swing your back.'],
      form: { works: 'Biceps, forearms',
        setup: ['Stand tall, feet hip-width.', 'Grip shoulder-width, palms facing forward.', 'Shoulders back, elbows by your sides.'],
        mistakes: [['Swinging your body', 'Stand with your back against a wall, or take weight off.'], ['Elbows drifting forward', 'Keep them fixed at your sides.'], ['Cutting the bottom short', 'Straighten your arms fully each rep.']] },
      demo: { period: 2800, lead: 'lift', go: 'Curl', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, BAR('hand', 6)],
        poses: [{ ...STAND, handTo: 'hang' }, { handTo: [59, 30] }] } },
    { id: 'db-curl', name: 'Dumbbell Curl', group: 'Arms', equipment: 'dumbbell', inc: 2, min: 10, max: 15, rest: 60,
      cues: ['Palms facing forward, elbows at your sides.', 'Curl up, turning your little finger slightly up.', 'Lower all the way down.'],
      form: { works: 'Biceps',
        setup: ['Stand tall with the dumbbells at your sides.', 'Shoulders back, elbows close to your ribs.'],
        mistakes: [['Swinging the dumbbells', 'Pause at the bottom of each rep.'], ['Elbows drifting forward', 'Keep them fixed at your sides.'], ['Rushing the way down', 'Take two to three seconds to lower.']] },
      demo: { period: 2800, lead: 'lift', go: 'Curl', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ ...STAND, handTo: 'hang' }, { handTo: [59, 30] }] } },
    { id: 'hammer-curl', name: 'Hammer Curl', group: 'Arms', equipment: 'dumbbell', inc: 2, min: 10, max: 15, rest: 60,
      cues: ['Palms facing each other, elbows at your sides.', 'Curl up without twisting your wrists.', 'Lower all the way down.'],
      form: { works: 'Biceps, forearms',
        setup: ['Stand tall with the dumbbells at your sides, thumbs pointing forward.', 'Shoulders back, elbows close to your ribs.'],
        mistakes: [['Swinging the dumbbells', 'Pause at the bottom of each rep.'], ['Wrists turning palm-up', 'Keep your thumbs on top the whole way.'], ['Elbows flaring out', 'Keep them tight to your sides.']] },
      demo: { period: 2800, lead: 'lift', go: 'Curl', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, DB()],
        poses: [{ ...STAND, handTo: 'hang' }, { handTo: [59, 30] }] } },
    { id: 'triceps-pushdown', name: 'Triceps Pushdown', group: 'Arms', equipment: 'cable', inc: 2.5, min: 10, max: 15, rest: 60,
      cues: ['Pin your elbows to your sides.', 'Push down until your arms are straight.', 'Let the handle rise to chest height under control.'],
      form: { works: 'Triceps',
        setup: ['Set the pulley high with a bar or rope.', 'Stand close, lean forward slightly and bring your elbows to your sides.', 'Start with your forearms just above level.'],
        mistakes: [['Elbows moving forward and back', 'Only your forearms should move.'], ['Leaning your bodyweight onto the bar', 'Stay tall and use less weight.'], ['Stopping short', 'Straighten your arms fully and squeeze.']] },
      demo: { period: 2800, lead: 'lift', go: 'Push down', back: 'Return slowly', statics: FLOOR + column(68), items: [CABLE(), ...BODY, ...HEAD, ...ARM, GRIP()],
        poses: [{ ...STAND, fixed: { pulley: [66, 6] }, handTo: [57, 33] }, { handTo: [53, 49] }] } },
    { id: 'overhead-triceps-extension', name: 'Overhead Triceps Extension', group: 'Arms', equipment: 'dumbbell', inc: 2, min: 10, max: 15, rest: 60,
      cues: ['Hold one dumbbell overhead with both hands.', 'Lower it behind your head, elbows pointing up.', 'Straighten your arms without moving your elbows.'],
      form: { works: 'Triceps',
        setup: ['Cup the top end of one dumbbell in both hands.', 'Press it overhead to straight arms.', 'Brace so your ribs stay down.'],
        mistakes: [['Elbows flaring wide', 'Keep them pointing forward, close to your head.'], ['Lower back arching', 'Squeeze your glutes. Do it seated if the arch persists.'], ['Short range', 'Lower until your forearms pass level.']] },
      demo: { period: 3100, view: '-6 -11 112 112', lead: 'lower', go: 'Extend', back: 'Lower slowly', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, DB('hand', 4.5)],
        poses: [{ ...STAND, handTo: [52, 1], armBend: 1 }, { handTo: [44, 20] }] } },
    { id: 'skull-crusher', name: 'Skull Crusher', group: 'Arms', equipment: 'barbell', inc: 2.5, min: 8, max: 12, rest: 90,
      cues: ['Lie on a bench with the bar over your shoulders.', 'Bend only at the elbows to lower the bar to your forehead.', 'Straighten your arms back up.'],
      form: { works: 'Triceps',
        setup: ['Lie on a bench holding the bar with a shoulder-width grip. An EZ bar is kinder on the wrists.', 'Press it to straight arms over your shoulders.', 'Tilt your arms slightly back towards your head.'],
        mistakes: [['Elbows flaring out', 'Keep them shoulder-width apart.'], ['Upper arms swinging', 'Hold them still so only your forearms move.'], ['Going too heavy', 'Use a weight you can stop above your forehead on every rep.']] },
      demo: { period: 3100, lead: 'lower', go: 'Extend', back: 'Lower slowly', statics: FLOOR + bench(30, 69, 50), items: [...BODY, ...HEAD, ...ARM, BAR('hand', 6)],
        poses: [{ ...LYING, handTo: [69, 42], armBend: 1 }, { handTo: [80, 53] }] } },
    { id: 'cable-curl', name: 'Cable Curl', group: 'Arms', equipment: 'cable', inc: 2.5, min: 10, max: 15, rest: 60,
      cues: ['Low pulley, elbows pinned to your sides.', 'Curl the handle up to your shoulders.', 'Lower slowly to straight arms.'],
      form: { works: 'Biceps',
        setup: ['Set a straight bar or rope on the lowest pulley.', 'Stand close, palms facing up.', 'Shoulders back, elbows by your sides.'],
        mistakes: [['Leaning back to start the rep', 'Stand tall and use less weight.'], ['Elbows drifting forward', 'Keep them fixed at your sides.'], ['Stopping short', 'Straighten your arms fully each rep.']] },
      demo: { period: 2800, lead: 'lift', go: 'Curl', back: 'Lower slowly', statics: FLOOR + column(82), items: [CABLE(), ...BODY, ...HEAD, ...ARM, GRIP()],
        poses: [{ ...STAND, fixed: { pulley: [80, 90] }, handTo: 'hang' }, { handTo: [59, 30] }] } },
    { id: 'close-grip-bench-press', name: 'Close-grip Bench Press', group: 'Arms', equipment: 'barbell', inc: 2.5, min: 6, max: 10, rest: 120,
      cues: ['Hands shoulder-width, elbows tucked.', 'Lower the bar to your lower chest.', 'Press up until your arms are straight.'],
      form: { works: 'Triceps, chest, front shoulders',
        setup: ['Lie with your eyes under the bar and your feet flat.', 'Grip about shoulder-width. Narrower strains the wrists.', 'Pinch your shoulder blades together and unrack to straight arms.'],
        mistakes: [['Hands too close together', 'Keep them about shoulder-width.'], ['Elbows flaring out', 'Keep them close to your sides as you lower.'], ['Bouncing off your chest', 'Touch lightly, then press.']], safety: 'Use safety arms or a spotter for heavy sets.' },
      demo: { period: 3400, lead: 'lower', go: 'Press', back: 'Lower slowly', statics: FLOOR + bench(30, 69, 50), items: [...BODY, ...HEAD, ...ARM, BAR()],
        poses: [{ ...LYING, handTo: [67, 42] }, { handTo: [59, 59] }] } },
    { id: 'preacher-curl', name: 'Preacher Curl', group: 'Arms', equipment: 'barbell', inc: 2.5, min: 8, max: 12, rest: 60,
      cues: ['Backs of your arms flat on the pad.', 'Curl the bar up until your forearms are upright.', 'Lower slowly to almost straight arms.'],
      form: { works: 'Biceps',
        setup: ['Set the seat so your armpits rest on the top of the pad.', 'Take an EZ bar with your palms facing up, hands shoulder-width.', 'Lay the backs of your upper arms flat on the pad.'],
        mistakes: [['Lifting your elbows off the pad', 'Keep your upper arms pressed down.'], ['Dropping into the bottom', 'Lower under control and stop just short of locked.'], ['Leaning back to finish', 'Stay still. Stop when your forearms are upright.']] },
      demo: { period: 3000, lead: 'lift', go: 'Curl', back: 'Lower slowly', statics: FLOOR + line(40, 50, 54, 64) + line(50, 64, 50, 93) + line(24, 76, 42, 76) + line(32, 76, 32, 93), items: [...BODY, ...HEAD, ...ARM, BAR('hand', 6)],
        poses: [{ anchor: 'hip', pos: [32, 72], torso: 80, neck: 70, thigh: 0, shin: -90, handTo: [58, 62], armBend: 1 }, { handTo: [48, 38] }] } },
    { id: 'bench-dip', name: 'Bench Dip', group: 'Arms', equipment: 'bodyweight', repsOnly: true, inc: null, min: 10, max: 20, rest: 60,
      cues: ['Hands on the bench edge behind you, legs out in front.', 'Bend your elbows straight back to lower your hips.', 'Press back up to straight arms.'],
      form: { works: 'Triceps, front shoulders',
        setup: ['Sit on the edge of a bench with your hands beside your hips, fingers forward.', 'Walk your feet out and slide your hips off the bench.', 'Keep your back close to the bench.'],
        mistakes: [['Elbows flaring out', 'Point them straight back.'], ['Going too deep', 'Stop when your upper arms are level with the floor.'], ['Pushing with your legs', 'Keep them relaxed. Straighten them out to make it harder.']] },
      demo: { period: 3000, lead: 'lower', go: 'Press up', back: 'Lower slowly', statics: FLOOR + bench(10, 64, 30), items: [...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'hand', pos: [37, 63], fore: -90, upper: -90, torso: 92, legTo: [80, 92], legBend: -1, foot: 70 }, { fore: -82, upper: -152, torso: 88 }] } },

    // Core
    { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', group: 'Core', equipment: 'bodyweight', repsOnly: true, inc: null, min: 8, max: 15, rest: 60,
      cues: ['Hang with straight arms and your shoulders engaged.', 'Raise your legs until your thighs are level with your hips.', 'Lower slowly without swinging.'],
      form: { works: 'Abs, hip flexors',
        setup: ['Hang from the bar with a shoulder-width grip.', 'Pull your shoulders down away from your ears.', 'Tilt your pelvis so your lower back is flat, not arched.'],
        mistakes: [['Swinging', 'Pause at the bottom until you are still.'], ['Using momentum', 'Lift slowly and stop for a beat at the top.'], ['Only your hips moving', 'Curl your pelvis up towards your ribs as your legs rise.']] },
      demo: { period: 3400, view: '-7 0 114 114', lead: 'lift', go: 'Raise', back: 'Lower slowly', focus: 'leg', statics: pullupBar, items: [...BODY, ...HEAD, ...ARM],
        poses: [{ ...HANG, shin: -95 }, { thigh: -5, shin: -40 }] } },
    { id: 'cable-crunch', name: 'Cable Crunch', group: 'Core', equipment: 'cable', inc: 2.5, min: 10, max: 15, rest: 60,
      cues: ['Kneel facing the machine, rope beside your head.', 'Curl your chest down towards your knees.', 'Rise back up slowly, keeping your hips still.'],
      form: { works: 'Abs',
        setup: ['Set a rope on a high pulley and kneel about a foot-length away.', 'Hold the rope ends beside your head.', 'Keep your hips above your knees.'],
        mistakes: [['Sitting back onto your heels', 'Keep your hips still. The movement comes from your spine.'], ['Pulling with your arms', 'Lock your hands beside your head.'], ['Keeping a flat back', 'Round your spine and bring your ribs towards your pelvis.']] },
      demo: { period: 3100, lead: 'lift', go: 'Crunch', back: 'Return slowly', focus: 'torso', statics: FLOOR + column(80), items: [CABLE(), ...BODY, ...HEAD, ...ARM, GRIP()],
        poses: [{ anchor: 'hip', pos: [44, 71], torso: 92, neck: 85, thigh: -90, shin: 180, foot: 180, fixed: { pulley: [78, 4] }, handTo: 'frontbar', armBend: -1 },
          { torso: 30, neck: 0 }] } },
    { id: 'hanging-knee-raise', name: 'Hanging Knee Raise', group: 'Core', equipment: 'bodyweight', repsOnly: true, inc: null, min: 10, max: 15, rest: 60,
      cues: ['Hang with straight arms and your shoulders engaged.', 'Bring your knees up towards your chest.', 'Lower slowly without swinging.'],
      form: { works: 'Abs, hip flexors',
        setup: ['Hang from the bar with a shoulder-width grip.', 'Pull your shoulders down away from your ears.', 'Let your legs hang straight and still.'],
        mistakes: [['Swinging', 'Pause at the bottom until you are still.'], ['Stopping at hip height', 'Curl your pelvis up so your knees come towards your chest.'], ['Dropping your legs', 'Lower them slowly.']] },
      demo: { period: 3000, view: '-7 0 114 114', lead: 'lift', go: 'Raise', back: 'Lower slowly', focus: 'leg', statics: pullupBar, items: [...BODY, ...HEAD, ...ARM],
        poses: [{ ...HANG, shin: -95 }, { thigh: 25, shin: -80, torso: 96 }] } },
    { id: 'crunch', name: 'Crunch', group: 'Core', equipment: 'bodyweight', repsOnly: true, inc: null, min: 12, max: 20, rest: 45,
      cues: ['Lie on your back, knees bent, feet flat.', 'Curl your shoulders off the floor towards your knees.', 'Lower slowly, one vertebra at a time.'],
      form: { works: 'Abs',
        setup: ['Lie on your back with your knees bent and feet flat.', 'Cross your arms over your chest, or rest your fingertips by your ears.', 'Press your lower back gently into the floor.'],
        mistakes: [['Pulling on your neck', 'Keep your hands light. Look at the ceiling, not your knees.'], ['Sitting all the way up', 'Lift your shoulder blades off the floor and no further.'], ['Rushing', 'Pause at the top and lower slowly.']] },
      demo: { period: 2800, lead: 'lift', go: 'Curl up', back: 'Lower slowly', focus: 'torso', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'hip', pos: [56, 89], torso: 180, neck: 180, thigh: 52, shin: -78, foot: 0, handTo: 'frontbar', armBend: 1 }, { torso: 148, neck: 132 }] } },
    { id: 'ab-wheel-rollout', name: 'Ab Wheel Rollout', group: 'Core', equipment: 'bodyweight', repsOnly: true, inc: null, min: 6, max: 12, rest: 90,
      cues: ['Kneel with the wheel under your shoulders.', 'Roll forward slowly, keeping your back flat.', 'Pull back in from your stomach, not your hips.'],
      form: { works: 'Abs, lats, hip flexors',
        setup: ['Kneel on a mat with the wheel on the floor in front of your knees.', 'Arms straight, shoulders over the wheel.', 'Tuck your pelvis and brace your stomach before you roll.'],
        mistakes: [['Lower back sagging', 'Only roll as far as you can keep it flat.'], ['Hips staying back as you roll', 'Move your hips forward with your shoulders.'], ['Bending your arms', 'Keep them straight throughout.']] },
      demo: { period: 3800, view: '-2 -10 112 112', lead: 'lower', go: 'Pull back in', back: 'Roll out slowly', focus: 'torso', statics: FLOOR, items: [...BODY, ...HEAD, ...ARM, DB('hand', 4.5)],
        poses: [{ anchor: 'ank', pos: [16, 90], shin: 180, thigh: -78, foot: 180, torso: 22, neck: 0, handTo: [62, 88] }, { thigh: -142, torso: 6, neck: 0, handTo: [100, 88] }] } },
    { id: 'dead-bug', name: 'Dead Bug', group: 'Core', equipment: 'bodyweight', repsOnly: true, inc: null, min: 8, max: 12, rest: 45, perSide: true,
      cues: ['On your back, arms up, knees over your hips.', 'Reach one arm back and the opposite leg out, just above the floor.', 'Bring them back and switch sides.'],
      form: { works: 'Abs, deep core',
        setup: ['Lie on your back with your arms straight up over your shoulders.', 'Lift your knees over your hips, bent at 90 degrees.', 'Press your lower back flat into the floor.'],
        mistakes: [['Lower back lifting off the floor', 'Shorten the reach until it stays flat.'], ['Rushing', 'Move slowly and breathe out as you reach.'], ['Moving the same-side arm and leg', 'Reach with opposite arm and leg.']] },
      demo: { period: 3600, view: '-6 0 108 108', lead: 'lift', go: 'Reach out', back: 'Bring back', focus: 'torso', statics: FLOOR, items: [...ARM2, ...LEG2, ...BODY, ...HEAD, ...ARM],
        poses: [{ anchor: 'hip', pos: [58, 89], torso: 180, neck: 180, thigh: 90, shin: 0, foot: 90, handTo: [30, 65], hand2To: [30, 65], leg2To: [77, 70], leg2Bend: -1 },
          { thigh: 12, shin: 4, foot: 80, handTo: [6, 84] }] } },
  ];

  // ---------- rendering ----------
  // Filled figure: every segment is a round-capped line of its own width, stacked in layers so the near limbs sit in front.
  const WIDTH = { torso: 10, thigh: 7.5, shin: 5.6, foot: 4.2, upper: 5.2, fore: 4.4, neck: 4.6 };
  const RADIUS = { head: 6.2, hand: 2.7 };
  const ARM_PARTS = ['upper', 'fore', 'hand'];
  const FOCUS = { leg: ['thigh', 'shin', 'foot'], arm: ARM_PARTS, torso: ['torso'] };
  const LAYER = { torso: 4, neck: 4, head: 4, thigh: 5, shin: 5, foot: 5, upper: 7, fore: 7, hand: 7 };

  const FIG_CSS = `
.fig{display:block;width:100%;height:auto;--fg-ground:var(--fig-bg,var(--bg,#f5f5f2));--fg-ink:var(--ink,#2c2c24);--fg-accent:var(--accent,#f87f3b);--fg-line:var(--line,#dddcd4)}
.fig .fg-l{fill:none;stroke:var(--c);stroke-linecap:round}
.fig .fg-c{fill:var(--c);stroke:none}
.fig .fg-body{--c:color-mix(in srgb,var(--fg-ink) 84%,var(--fg-ground))}
.fig .fg-far{--c:color-mix(in srgb,var(--fg-ink) 40%,var(--fg-ground))}
.fig .fg-work{--c:var(--fg-accent)}
.fig .fg-halo{--c:var(--fg-ground)}
.fig .fg-plate{--c:color-mix(in srgb,var(--fg-ink) 24%,var(--fg-ground));stroke:color-mix(in srgb,var(--fg-ink) 46%,var(--fg-ground));stroke-width:1.4}
.fig .fg-weight{--c:color-mix(in srgb,var(--fg-ink) 56%,var(--fg-ground));stroke:var(--fg-ground);stroke-width:1}
.fig .fg-barend{--c:color-mix(in srgb,var(--fg-ink) 22%,var(--fg-ground))}
.fig .fg-cable{stroke:color-mix(in srgb,var(--fg-ink) 46%,var(--fg-ground));stroke-width:1.2}
.fig .fg-path{fill:none;stroke:color-mix(in srgb,var(--fg-ink) 46%,var(--fg-ground));stroke-width:1.1;stroke-linecap:round;stroke-dasharray:.1 3.2}
.fig .prop{fill:var(--fg-line);stroke:var(--fg-line);stroke-width:3;stroke-linecap:round}
.fig .rail{stroke-dasharray:3 3}`;
  if (typeof document !== 'undefined' && !document.getElementById('fig-css')) {
    const st = document.createElement('style');
    st.id = 'fig-css';
    st.textContent = FIG_CSS;
    document.head.appendChild(st);
  }

  const byId = Object.fromEntries(LIBRARY.map((e) => [e.id, e]));
  const poseAt = (d, ph) => compute(lerpSpec(d.poses[0], d.poses[1], ph));
  const f1 = (x) => x.toFixed(1);

  // Turn a Demo's parts into drawables, back to front.
  function build(e) {
    const d = e.demo, work = FOCUS[d.focus || (e.group === 'Legs' ? 'leg' : 'arm')];
    const out = [];
    d.items.forEach((it) => {
      const p = it.part;
      if (p === 'cable') out.push({ l: it.l, w: 0, cls: 'fg-cable', z: 1 });
      else if (p === 'plate') out.push({ c: it.c, r: it.r, cls: 'fg-plate', z: 3 }, { c: it.c, r: 1.8, cls: 'fg-barend', z: 8 });
      else if (p === 'pad') out.push({ c: it.c, r: it.r, cls: 'fg-plate', z: 3 });
      else if (p === 'weight') out.push({ c: it.c, r: it.r, cls: 'fg-weight', z: 8 });
      else {
        const role = it.far ? 'fg-far' : work.includes(p) ? 'fg-work' : 'fg-body';
        const z = it.far ? 2 : LAYER[p], near = !it.far && ARM_PARTS.includes(p);
        if (it.l) {
          const w = it.w || WIDTH[p];
          if (near) out.push({ l: it.l, w: w + 2.1, cls: 'fg-halo', z: 6 });   // outline so the arm reads against the body
          out.push({ l: it.l, w, cls: role, z });
        } else {
          const r = it.r || RADIUS[p];
          if (near) out.push({ c: it.c, r: r + 1.05, cls: 'fg-halo', z: 6 });
          out.push({ c: it.c, r, cls: role, z });
        }
      }
    });
    return out.map((x, i) => [x, i]).sort((a, b) => a[0].z - b[0].z || a[1] - b[1]).map((x) => x[0]);
  }

  // Dotted trail of where the weight travels during the rep.
  function trail(d) {
    if (d.trail === false) return '';
    const pts = [...new Set(d.items.filter((it) => it.c && ['plate', 'weight', 'pad'].includes(it.part)).map((it) => it.c))];
    const N = 16, frames = Array.from({ length: N + 1 }, (_, i) => poseAt(d, i / N));
    return pts.map((c) => {
      const path = frames.map((P) => P[c]);
      const reach = Math.max(...path.map((p) => Math.hypot(p[0] - path[0][0], p[1] - path[0][1])));
      return reach < 5 ? '' : `<polyline class="fg-path" points="${path.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ')}"/>`;
    }).join('');
  }

  LIBRARY.forEach((e) => { e.demo.draw = build(e); e.demo.trail = trail(e.demo); });

  // ---------- tempo: set up, first half, pause, second half ----------
  // 'lower' Demos start at the top (squat, bench): slow down, pause, drive up.
  // 'lift' Demos start at the bottom (deadlift, row, curl): lift, hold, slow down.
  const TIMELINE = { lower: [.10, .50, .62, .88], lift: [.10, .36, .50, .90] };
  const ease = (u) => u * u * (3 - 2 * u);
  function tempo(d, u) {
    const [a, b, c, e] = TIMELINE[d.lead] || TIMELINE.lift;
    if (u < a || u >= e) return { ph: 0, stage: 0 };
    if (u < b) return { ph: ease((u - a) / (b - a)), stage: 1 };
    if (u < c) return { ph: 1, stage: 2 };
    return { ph: 1 - ease((u - c) / (e - c)), stage: 3 };
  }
  // What to show for a stage: a short label and which of the Exercise's cues applies.
  function stageInfo(id, stage) {
    const d = byId[id].demo, lower = d.lead === 'lower';
    const label = lower ? ['Set up', d.back, 'Pause', d.go][stage] : ['Set up', d.go, 'Hold', d.back][stage];
    return { id, stage, label, cue: (lower ? [0, 1, 1, 2] : [0, 1, 2, 2])[stage] };
  }

  function figSVG(id, label, phase = 0) {
    const d = byId[id].demo, P = poseAt(d, phase);
    const items = d.draw.map((it, n) => it.l
      ? `<line data-k="${n}" class="fg-l ${it.cls}"${it.w ? ` stroke-width="${it.w}"` : ''} x1="${f1(P[it.l[0]][0])}" y1="${f1(P[it.l[0]][1])}" x2="${f1(P[it.l[1]][0])}" y2="${f1(P[it.l[1]][1])}"/>`
      : `<circle data-k="${n}" class="fg-c ${it.cls}" r="${it.r}" cx="${f1(P[it.c][0])}" cy="${f1(P[it.c][1])}"/>`).join('');
    return `<svg class="fig" viewBox="${d.view || '0 0 100 100'}" data-fig="${id}" role="img" aria-label="${label || byId[id].name}">${d.statics || ''}${d.trail}${items}</svg>`;
  }

  function pose(svg, d, P, els) {
    els.forEach((el) => {
      const it = d.draw[+el.dataset.k];
      if (it.l) {
        const a = P[it.l[0]], b = P[it.l[1]];
        el.setAttribute('x1', f1(a[0])); el.setAttribute('y1', f1(a[1])); el.setAttribute('x2', f1(b[0])); el.setAttribute('y2', f1(b[1]));
      } else { el.setAttribute('cx', f1(P[it.c][0])); el.setAttribute('cy', f1(P[it.c][1])); }
    });
  }

  // Each animated figure fires a bubbling "figstage" event when its stage changes: detail = { id, stage, label, cue, still }.
  let running = false;
  function startAnimation() {
    if (running) return;
    running = true;
    const reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const parts = new WeakMap();
    const frame = (now) => {
      document.querySelectorAll('svg[data-fig]:not([data-still])').forEach((svg) => {
        const id = svg.dataset.fig, d = byId[id].demo;
        const t = reduce ? { ph: 1, stage: 2 } : tempo(d, (now % d.period) / d.period);
        if (!parts.has(svg)) parts.set(svg, [...svg.querySelectorAll('[data-k]')]);
        if (svg.dataset.stage !== String(t.stage)) {
          svg.dataset.stage = t.stage;
          svg.dispatchEvent(new CustomEvent('figstage', { bubbles: true, detail: { ...stageInfo(id, t.stage), still: !!reduce } }));
        } else if (reduce) return;
        pose(svg, d, poseAt(d, t.ph), parts.get(svg));
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  global.WorkoutLibrary = { LIBRARY, byId, figSVG, startAnimation, tempo, stageInfo };
})(typeof window !== 'undefined' ? window : globalThis);
