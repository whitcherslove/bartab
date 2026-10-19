import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { applyTheme } from './lib/theme';

applyTheme();

/** Если что-то упало при отрисовке — показываем ошибку и кнопки вместо пустого экрана */
class Crash extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    const reset = (window as unknown as { __bartabReset?: () => void }).__bartabReset;
    return (
      <main className="auth">
        <div className="brand">🍻 BarTab</div>
        <p className="auth-sub">Что-то пошло не так. Попробуй перезагрузить, а если не поможет — сбросить кэш (данные не пропадут).</p>
        <button className="btn primary block" onClick={() => location.reload()}>Перезагрузить</button>
        <button className="btn block" onClick={() => (reset ? reset() : location.reload())}>Сбросить кэш и перезагрузить</button>
        <pre className="crash-text">{String(this.state.error?.message ?? this.state.error)}</pre>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Crash>
      <App />
    </Crash>
  </StrictMode>,
);
