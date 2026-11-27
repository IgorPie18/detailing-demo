// Osobny moduł schematu uszkodzeń w React (MonkJS VehicleDynamicWireframe). Reszta panelu zostaje w zwykłym JS:
// window.MonkWire.mount(el, {model, parts:{id:{color}}, locked, onPart(id)}) → {update(props), unmount()}
import { createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VehicleDynamicWireframe } from '@monkvision/common-ui-web/lib/components/VehicleDynamicWireframe/VehicleDynamicWireframe.js';

const ORI = [['front-left', 'Przód, lewa strona'], ['front-right', 'Przód, prawa strona'], ['rear-right', 'Tył, prawa strona'], ['rear-left', 'Tył, lewa strona']];

function Wire({ model, parts = {}, locked, onPart }) {
  const [o, setO] = useState(0);
  const turn = (d) => setO((x) => (x + d + ORI.length) % ORI.length);
  const attrs = (p) => ({ style: { fill: parts[p] ? parts[p].color : 'rgba(255,255,255,0.001)', stroke: parts[p] ? '#1c1917' : '#78716c', strokeWidth: 1.4, cursor: locked ? 'default' : 'pointer', transition: 'fill .18s' } });
  return h('div', { className: 'mw' },
    h('div', { className: 'mw-svg' }, h(VehicleDynamicWireframe, { vehicleType: model, orientation: ORI[o][0], onClickPart: locked ? () => {} : (p) => onPart && onPart(p), getPartAttributes: attrs })),
    h('div', { className: 'mw-bar' },
      h('button', { type: 'button', onClick: () => turn(-1), 'aria-label': 'Obróć w lewo' }, '‹'),
      h('span', { 'aria-live': 'polite' }, ORI[o][1]),
      h('button', { type: 'button', onClick: () => turn(1), 'aria-label': 'Obróć w prawo' }, '›')));
}

window.MonkWire = {
  mount(el, props) {
    const root = createRoot(el); let cur = props;
    const render = () => root.render(h(Wire, cur));
    render();
    return { update(p) { cur = { ...cur, ...p }; render(); }, unmount() { root.unmount(); } };
  },
};
