# Testy mini CMS (edytor strony salonu)

Bez serwera: Playwright podstawia pliki z dysku pod `http://app.test`, a zapisy do bazy (PATCH `studios`, upload do Storage) zastępuje atrapą, więc testy nie zmieniają danych demo.

```
PW="$(npm root -g)/@playwright/cli/node_modules/playwright" node tools/cms-testy/edytor.cjs           # 20 kroków: panel, edytor, podgląd na żywo, publikacja, telefon
PW="$(npm root -g)/@playwright/cli/node_modules/playwright" node tools/cms-testy/regresja-klient.cjs   # 10 kroków: demo telefonu bez zmian, ciemna paleta
```
Wymaga Edge (channel msedge) i `a_detailing/.env` (ADMIN_EMAIL, ADMIN_PASSWORD) do logowania w panelu. Zrzuty lądują w katalogu z `SP` albo w TEMP.
