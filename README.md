# Rezerwacje dla studia detailingu (demo)

Strona salonu z rezerwacją online i panel salonu. Statyczny HTML na GitHub Pages i Supabase (baza, logowanie, zdjęcia, realtime).

- `index.html`: cała aplikacja (widok klienta `#klient`, panel `#panel`)
- `schema.sql`: tabele, reguły dostępu (RLS), bucket na zdjęcia; wklej w Supabase → SQL Editor → Run
- `assets/`: zdjęcia z [Pexels](https://www.pexels.com/license/) (licencja Pexels, bez wymogu podpisu)

Klucz w `index.html` to klucz publiczny Supabase (`sb_publishable_…`), jawny z założenia. Dane chronią reguły RLS:
klient może tylko dodać rezerwację, czytać i zmieniać je może zalogowany właściciel salonu.
Klucza `sb_secret_…` nigdy nie wrzucaj do repo.

Salon wybiera parametr `?salon=<slug>` (domyślnie `lumen`).
