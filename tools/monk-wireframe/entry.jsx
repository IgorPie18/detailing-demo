// Osobny moduł schematu uszkodzeń w React (MonkJS VehicleDynamicWireframe). Reszta panelu zostaje w zwykłym JS:
// window.MonkWire.mount(el, {model, parts:{id:{color}}, locked, onPart(id)}) → {update(props), unmount()}
import { createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VehicleDynamicWireframe } from '@monkvision/common-ui-web/lib/components/VehicleDynamicWireframe/VehicleDynamicWireframe.js';

const ORI = [['front-left', 'Przód, lewa strona'], ['front-right', 'Przód, prawa strona'], ['rear-right', 'Tył, prawa strona'], ['rear-left', 'Tył, lewa strona']];

// preview: kolor wybranego rodzaju szkody, pokazywany po najechaniu na niezaznaczoną część; sel: część otwarta w szczegółach (pomarańczowa obwódka)
function Wire({ model, parts = {}, locked, onPart, preview, sel }) {
  const [o, setO] = useState(0);
  const [hov, setHov] = useState(null);
  const turn = (d) => setO((x) => (x + d + ORI.length) % ORI.length);
  const attrs = (p) => {
    const on = parts[p], hv = !locked && !on && hov === p && preview;
    return {
      onMouseEnter: () => setHov(p), onMouseLeave: () => setHov((h) => (h === p ? null : h)),
      style: { fill: on ? on.color : hv ? preview : 'rgba(255,255,255,0.001)', fillOpacity: hv ? 0.55 : 1, stroke: sel === p ? '#c2410c' : on ? '#1c1917' : '#78716c',
        strokeWidth: sel === p ? 2.6 : 1.4, cursor: locked ? 'default' : 'pointer', transition: 'fill .15s, fill-opacity .15s' },
    };
  };
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
