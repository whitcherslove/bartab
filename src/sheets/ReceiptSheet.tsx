import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { money, uid } from '../lib/format';
import { Icon } from '../components/Icons';

// Пока имитация. На этапе 6 здесь будет вызов серверной функции parse-receipt.
const DEMO = [
  { name: 'IPA 0,5', price: 390, qty: 4 },
  { name: 'Сидр яблочный', price: 360, qty: 2 },
  { name: 'Гренки чесночные', price: 290, qty: 1 },
  { name: 'Бургер классический', price: 640, qty: 1 },
  { name: 'Вода', price: 120, qty: 2 },
];

export function ReceiptSheet({ eventId }: { eventId: string }) {
  const { updateEvent } = useStore();
  const ui = useUI();
  const [scanning, setScanning] = useState(false);

  const onFile = () => {
    setScanning(true);
    setTimeout(() => {
      const sum = DEMO.reduce((s, r) => s + r.price * r.qty, 0);
      updateEvent(eventId, (e) => {
        DEMO.forEach((r) => e.items.push({ id: uid(), ...r, splitMode: 'equal', consumers: [...e.members], split: {} }));
        e.status = `✅ Распознано позиций: ${DEMO.length}, итог по чеку: ${money(sum)}`;
      });
      ui.close();
      ui.toast('Чек распознан');
    }, 1600);
  };

  if (scanning) {
    return (
      <div className="scan">
        <div className="spinner" role="status" aria-label="Распознаю" />
        <b>Распознаю чек…</b>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Обычно это 5–15 секунд</span>
      </div>
    );
  }

  return (
    <>
      <h4>Загрузить чек</h4>
      <p style={{ color: 'var(--muted)', margin: '-6px 0 16px', fontSize: 15 }}>
        Сфотографируй чек целиком, позиции добавятся сами и разделятся на всех участников.
      </p>
      <label className="btn primary block" style={{ cursor: 'pointer' }}>
        {Icon.cam} Сфотографировать или выбрать
        <input type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      </label>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '12px 0 0' }}>Пока распознавание имитируется демо-позициями.</p>
    </>
  );
}
