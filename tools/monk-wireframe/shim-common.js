// z @monkvision/common komponent używa tylko 3 funkcji; reszta paczki (sieć, logowanie, analityka) jest niepotrzebna
const str = require('./node_modules/@monkvision/common/lib/utils/string.utils.js');
exports.toCamelCase = str.toCamelCase;
exports.capitalize = str.capitalize;
// podajemy od razu id modelu (np. haccord), więc mapowanie typu auta na model nie jest potrzebne
exports.getVehicleModel = (m) => m;
