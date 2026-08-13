# Backlog

Świadome decyzje o odłożeniu pracy i znane luki. Nie są to bugi do naprawienia
od razu — to rzeczy, o których wiemy, z zapisanym powodem i momentem, w którym
staną się istotne.

---

## Stripe Connect — płatności na konta użytkowników

**Status:** odłożone (decyzja z 2026-07-24)
**Zrobić, gdy:** pierwsza obca osoba założy konto w instancji
**Szacowany nakład:** 2–3 dni

### Problem

Aplikacja ma jedno gniazdo na klucz Stripe (`STRIPE_SECRET_KEY`). Wszystkie
płatności za faktury lądują na koncie właściciela tego klucza.

Dla obecnego użycia (jeden operator, self-host) jest to **poprawne** — klucz
jest Pawła, pieniądze idą do Pawła.

Problem pojawia się dopiero przy wielu użytkownikach: gdyby Anna wystawiła
fakturę przez tę instancję, jej klient zapłaciłby na konto operatora, nie Anny.
Oznaczałoby to trzymanie cudzych środków (działalność płatnicza wymagająca
licencji) i ręczne rozliczanie każdej wpłaty.

### Rozwiązanie

Stripe Connect — każdy użytkownik podpina własne konto Stripe:

- onboarding konta połączonego (Connect Onboarding)
- `stripeAccountId` na modelu `User`
- nagłówek `Stripe-Account` przy tworzeniu sesji checkout
- obsługa webhooków przychodzących z kont połączonych
- opcjonalnie `application_fee` — gotowy mechanizm prowizji, jeśli kiedyś
  monetyzacja ma iść przez procent od transakcji

### Kontekst w kodzie

Ograniczenie opisane w nagłówku `src/lib/stripe.ts`.

---

## Faktury zgodne z polskimi wymogami (NIP / VAT)

**Status:** niezrobione, nieistotne dla rynku anglojęzycznego
**Zrobić, gdy:** celem stanie się rynek polski

Schemat nie ma pola NIP (ani po stronie `Settings`, ani `Client`) i nie
rozbija VAT na stawki — jest jedna wartość `taxRate` na fakturę. To wystarcza
dla generycznej faktury międzynarodowej, ale nie spełnia wymogów polskiej
faktury VAT.

Zakres: pola NIP sprzedawcy i nabywcy, pozycje z osobnymi stawkami VAT,
podsumowanie w rozbiciu na stawki, oznaczenia typu "mechanizm podzielonej
płatności" tam, gdzie wymagane.

---

## Mniejsze rzeczy

- **Weryfikacja e-mail przy rejestracji** — `/register` przyjmuje dowolny
  adres bez potwierdzenia.
- **Rate limiting w pamięci procesu** (`src/lib/rateLimit.ts`) — działa dla
  jednej instancji. Przy skalowaniu poziomym wymaga przeniesienia do Redis.

---

## Zrobione

- **Reset hasła** (2026-07-24) — flow "zapomniałem hasła" z tokenem
  jednorazowym, wygasającym po 60 minutach, przechowywanym w bazie wyłącznie
  jako hash. Zmiana hasła unieważnia wszystkie istniejące sesje przez
  `User.passwordChangedAt`.

  **Uwaga architektoniczna:** sprawdzenie `passwordChangedAt` wymaga zapytania
  do bazy, więc żyje w `src/lib/auth.ts` (runtime Node). `src/proxy.ts`
  (dawniej `src/middleware.ts` — Next 16 zmienił nazwę konwencji) korzysta
  z `src/lib/auth.config.ts`, który nie może importować Prismy — działa
  w Edge Runtime. Nie łącz tych dwóch plików: import Prismy do `proxy.ts`
  powoduje, że **każda** strona przekierowuje na `/login`.

- **Opcjonalna data płatności faktury** (2026-07-24) — `Invoice.dueDate` jest
  teraz nullowalne; faktura może mieć samą datę wystawienia.
