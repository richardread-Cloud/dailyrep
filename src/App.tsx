import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from './data/db';
import { getSettings } from './data/repo';
import { registerCustomExercises } from './lib/library';
import { ExerciseScreen } from './screens/ExerciseScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { ProgramScreen } from './screens/ProgramScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SessionScreen } from './screens/SessionScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { TemplateScreen } from './screens/TemplateScreen';

export type Route =
  | { name: 'home' }
  | { name: 'session'; id: string }
  | { name: 'summary'; id: string }
  | { name: 'program' }
  | { name: 'template'; id: string }
  | { name: 'progress' }
  | { name: 'history' }
  | { name: 'exercise'; id: string; from: Route }
  | { name: 'settings' };

export type Go = (r: Route) => void;

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [dbError, setDbError] = useState<string | null>(null);
  const settings = useLiveQuery(() => getSettings(), []);
  const customs = useLiveQuery(() => db.customExercises.toArray(), []);
  // Screens look Exercises up synchronously, so the Custom ones are registered before anything renders.
  if (customs) registerCustomExercises(customs);

  useEffect(() => {
    db.open().catch((e: unknown) => setDbError(e instanceof Error ? e.message : String(e)));
  }, []);

  const go: Go = (r) => { setRoute(r); window.scrollTo(0, 0); };

  if (dbError) {
    return (
      <div className="fatal">
        <h1 className="title">DailyRep can't save data here</h1>
        <p>This browser is blocking on-device storage, so your workouts can't be saved. Open DailyRep in Safari (not a private window) and try again.</p>
        <p className="small muted">{dbError}</p>
      </div>
    );
  }
  if (!settings || !customs) return null;
  if (!settings.onboarded) return <Onboarding go={go} unit={settings.unit} />;

  switch (route.name) {
    case 'home': return <Home go={go} />;
    case 'session': return <SessionScreen id={route.id} go={go} />;
    case 'summary': return <SummaryScreen id={route.id} go={go} />;
    case 'program': return <ProgramScreen go={go} />;
    case 'template': return <TemplateScreen id={route.id} go={go} />;
    case 'progress': return <ProgressScreen go={go} />;
    case 'history': return <HistoryScreen go={go} />;
    case 'exercise': return <ExerciseScreen key={route.id} id={route.id} back={route.from} go={go} />;
    case 'settings': return <SettingsScreen go={go} />;
  }
}
