import qrcode from 'qrcode-generator';
import type { ReactNode } from 'react';
import { useAccount } from '../lib/account';
import { CrewAvatar } from '../components/common';

/** Картинка QR-кода для ссылки: чёрное на белом, чтобы камеры читали надёжно */
export function QrCode({ link }: { link: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const n = qr.getModuleCount();
  const cells: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c} ${r}h1v1h-1z`);
  return (
    <div className="qr-box">
      <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label="QR-код" shapeRendering="crispEdges">
        <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
        <path d={cells.join('')} fill="#111" />
      </svg>
    </div>
  );
}

/** Шторка с QR: приглашение в компанию (по умолчанию) или любая ссылка */
export function QrSheet({ link, title, hint, top }: { link?: string; title?: string; hint?: string; top?: ReactNode }) {
  const acc = useAccount();
  return (
    <div className="qr-sheet">
      {top ?? <CrewAvatar crew={acc.crew} size={56} />}
      <h4>{title ?? `«${acc.crew.name}»`}</h4>
      <QrCode link={link ?? acc.inviteLink} />
      <p className="hint" style={{ textAlign: 'center', margin: '12px 0 0' }}>
        {hint ?? 'Друг наводит обычную камеру телефона на код, входит — и сразу в компании. Потом приложение предложит установиться на телефон.'}
      </p>
    </div>
  );
}
