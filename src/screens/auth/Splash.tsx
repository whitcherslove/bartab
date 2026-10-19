export function Splash({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <main className="auth">
      <div className="brand">🍻 BarTab</div>
      {message ? (
        <>
          <p className="auth-err">{message}</p>
          {onRetry && <button className="btn" onClick={onRetry}>Повторить</button>}
        </>
      ) : (
        <div className="spinner" role="status" aria-label="Загрузка" />
      )}
    </main>
  );
}
