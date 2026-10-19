import { StoreProvider } from './lib/store';
import { AccountGate } from './lib/account';
import { UIProvider, useUI, type View } from './lib/ui';
import { Icon } from './components/Icons';
import { EventsScreen } from './screens/EventsScreen';
import { EventScreen } from './screens/EventScreen';
import { PeopleScreen } from './screens/PeopleScreen';
import { PlacesScreen } from './screens/PlacesScreen';

export default function App() {
  return (
    <AccountGate>
      <StoreProvider>
        <UIProvider>
          <Shell />
        </UIProvider>
      </StoreProvider>
    </AccountGate>
  );
}

function Shell() {
  const { view } = useUI();
  return (
    <>
      <main className="app">
        {view.screen === 'event' ? (
          <EventScreen id={view.id} />
        ) : view.screen === 'people' ? (
          <PeopleScreen />
        ) : view.screen === 'places' ? (
          <PlacesScreen />
        ) : (
          <EventsScreen />
        )}
      </main>
      {view.screen !== 'event' && <TabBar current={view.screen} />}
    </>
  );
}

function TabBar({ current }: { current: View['screen'] }) {
  const { go } = useUI();
  const tab = (screen: 'events' | 'people' | 'places', icon: keyof typeof Icon, label: string) => (
    <button className="tab" aria-current={current === screen ? 'page' : undefined} onClick={() => go({ screen })}>
      {Icon[icon]}
      {label}
    </button>
  );
  return (
    <nav className="tabbar" aria-label="Разделы">
      <div className="tabbar-in">
        {tab('events', 'glass', 'Посиделки')}
        {tab('people', 'people', 'Люди')}
        {tab('places', 'pin', 'Бары')}
      </div>
    </nav>
  );
}
