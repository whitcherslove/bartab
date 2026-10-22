import { StoreProvider } from './lib/store';
import { AccountGate, useAccount } from './lib/account';
import { UIProvider, useUI, type View } from './lib/ui';
import { Icon } from './components/Icons';
import { useEffect, useState } from 'react';
import { getTabOrder, onTabsChange, TAB_ICONS, TAB_LABELS, type TabId } from './lib/tabs';
import { WelcomeSheet } from './sheets/WelcomeSheet';
import { InstallBanner } from './components/InstallBanner';
import { InstallSheet } from './sheets/InstallSheet';
import { shouldOfferInstall } from './lib/install';
import { EventsScreen } from './screens/EventsScreen';
import { EventScreen } from './screens/EventScreen';
import { CrewScreen } from './screens/CrewScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AdminScreen } from './screens/AdminScreen';
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
  const { view, open } = useUI();
  const { profile } = useAccount();

  // ссылка из уведомления: открыть вкладку или встречу
  const acc = useAccount();
  const { go } = useUI();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const tab = q.get('tab'), crew = q.get('crew'), event = q.get('event');
    if (!tab && !event) return;
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (crew && acc.crews.some((c) => c.id === crew) && crew !== acc.crew.id) acc.setCrewId(crew);
    if (event) go({ screen: 'event', id: event });
    else if (tab === 'crew' || tab === 'events' || tab === 'places' || tab === 'profile') go({ screen: tab });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // только что вступил по приглашению — поздравляем и предлагаем установить
  useEffect(() => {
    try {
      if (localStorage.getItem('bartab-welcome')) {
        localStorage.removeItem('bartab-welcome');
        localStorage.removeItem('bartab-install-intro');
        open(<WelcomeSheet />);
      } else if (localStorage.getItem('bartab-install-intro')) {
        localStorage.removeItem('bartab-install-intro');
        if (shouldOfferInstall()) open(<InstallSheet />);
      }
    } catch { /* ignore */ }
  }, [open]);
  return (
    <>
      <main className="app" key={profile.currency}>
        {view.screen !== 'event' && view.screen !== 'admin' && <InstallBanner />}
        {view.screen === 'event' ? (
          <EventScreen id={view.id} />
        ) : view.screen === 'crew' ? (
          <CrewScreen />
        ) : view.screen === 'profile' ? (
          <ProfileScreen />
        ) : view.screen === 'admin' ? (
          <AdminScreen />
        ) : view.screen === 'places' ? (
          <PlacesScreen />
        ) : (
          <EventsScreen />
        )}
      </main>
      {view.screen !== 'event' && view.screen !== 'admin' && <TabBar current={view.screen} />}
    </>
  );
}

function TabBar({ current }: { current: View['screen'] }) {
  const { go } = useUI();
  const { invites } = useAccount();
  const [order, setOrder] = useState<TabId[]>(getTabOrder);
  useEffect(() => onTabsChange(() => setOrder(getTabOrder())), []);
  return (
    <nav className="tabbar" aria-label="Разделы">
      <div className="tabbar-in">
        {order.map((screen) => (
          <button key={screen} className="tab" aria-current={current === screen ? 'page' : undefined} onClick={() => go({ screen })}>
            <span className="tab-ico">{Icon[TAB_ICONS[screen]]}{screen === 'crew' && invites.length > 0 && <i className="tab-dot" aria-label="Есть приглашения" />}</span>
            {TAB_LABELS[screen]}
          </button>
        ))}
      </div>
    </nav>
  );
}
