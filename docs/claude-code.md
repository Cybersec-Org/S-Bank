# Praca z Claude Code w repozytorium S-Bank

Ten dokument jest dla zespołu. Instrukcje dla samego Claude są w `AGENTS.md`, `CLAUDE.md` i katalogu `.claude/`.

## Co jest w `.claude/`

| Ścieżka                   | Do czego służy                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.json`           | uprawnienia: dozwolone skrypty `pnpm run …`, pytanie o zmiany zależności, **zakaz operacji Git**, zakaz czytania `.env` i kluczy; wyłączone wbudowane instrukcje commitów; rejestracja hooków |
| `hooks/guard-bash.mjs`    | blokuje polecenia zmieniające Git (także `git -C . commit`, `sh -c "…"`), zapisy przez `gh`, `curl … \| sh`, czytanie sekretów i `docker compose config` bez `--quiet`                        |
| `hooks/protect-files.mjs` | blokuje edycję `.env`, kluczy, zatwierdzonych migracji, plików generowanych i samych zabezpieczeń                                                                                             |
| `rules/*.md`              | zasady ładowane tylko przy pracy z pasującymi plikami: `app/`, `api/`, baza danych, infrastruktura i CI, testy                                                                                |
| `skills/`                 | procedury krok po kroku (lista niżej)                                                                                                                                                         |
| `agents/`                 | wyspecjalizowani podagenci (lista niżej)                                                                                                                                                      |

## Pierwsze uruchomienie

1. Rozpakuj pliki do pustego repozytorium (razem z README.md, REQUIREMENTS.md, BACKLOG.md i `docs/` z dokumentacji projektu).
2. Uruchom `claude` w katalogu repozytorium i zaakceptuj zaufanie do folderu (bez tego reguły `allow` i hooki agentów nie działają).
3. Wpisz `/bootstrap-project`. Claude przygotuje workspace, aplikację z makietami ekranów, API z pierwszą migracją, Docker Compose i dokumentację, a na końcu poda listę proponowanych commitów.
4. Przejrzyj zmiany i **sam wykonaj commity** (`git add`, `git commit`).
5. W GitHub: ochrona gałęzi `main` z wymaganymi sprawdzeniami `ci-success` i `security-gate`; jeśli repozytorium jest publiczne (albo ma GitHub Code Security) – zmienna repozytorium `ENABLE_CODE_SCANNING=true`.

## Skille

| Skill                | Kiedy                                                       |
| -------------------- | ----------------------------------------------------------- |
| `/bootstrap-project` | jednorazowo, na pustym repozytorium                         |
| `new-feature`        | nowa funkcja (FR-xx / B-xx) od bazy po ekran                |
| `new-screen`         | nowy lub zmieniony ekran                                    |
| `new-endpoint`       | nowy lub zmieniony endpoint API                             |
| `db-migration`       | zmiana schematu bazy                                        |
| `authz-tests`        | testy autoryzacji z kolumny „Czego NIE może”                |
| `security-audit`     | przegląd bezpieczeństwa zmian lub całego repozytorium       |
| `threat-model`       | aktualizacja modelu zagrożeń (STRIDE)                       |
| `adr`                | zapis decyzji architektonicznej                             |
| `dependency-update`  | dodanie lub aktualizacja zależności                         |
| `quality-gate`       | lokalnie te same sprawdzenia co CI                          |
| `prepare-commit`     | podsumowanie zmian i propozycje commitów (bez commitowania) |

Claude dobiera skille sam na podstawie prośby; można też wywołać je wprost, np. `/new-feature B-18`.

## Podagenci

`architect`, `mobile-developer`, `backend-developer`, `database-engineer`, `identity-engineer`, `devsecops-engineer`, `test-engineer`, `security-auditor`, `code-reviewer`, `docs-researcher`. Można poprosić o konkretnego: „Użyj agenta security-auditor do przejrzenia modułu transfers”.

## Przykładowe prośby

- „Zaimplementuj B-12 (rachunki i historia z kontrolą właściciela).”
- „Dodaj ekran odbiorców z edycją i usuwaniem – na razie na danych mock.”
- „Zrób audyt bezpieczeństwa zmian przed PR.”
- „Przygotuj podsumowanie do commita.”

## Czego Claude nie zrobi (celowo)

- Nie zrobi commita, pusha, nowej gałęzi ani PR – to zadanie właściciela repozytorium.
- Nie przeczyta ani nie zmieni `.env`, kluczy i certyfikatów – sekrety ustawiacie sami (`node scripts/dev-secrets.mjs` generuje lokalne).
- Nie zmieni swoich zabezpieczeń (`.claude/settings.json`, `.claude/hooks/`) – zaproponuje zmianę, a wy ją wprowadzacie.
- Nie edytuje zatwierdzonych migracji ani plików generowanych.

Prywatne ustawienia (np. dodatkowe uprawnienia na swoim komputerze) wpisuj w `.claude/settings.local.json` – plik jest ignorowany przez Git. Pamiętaj, że reguły `deny` z ustawień projektu i tak mają pierwszeństwo.

## Dla właściciela repozytorium

- Od Claude Code v2.1.295 hooki obsługują pole `"onFailure": "block"` – po jego dodaniu do obu hooków w `.claude/settings.json` awaria hooka (np. brak `node`) blokuje akcję zamiast ją przepuszczać. Pole jest celowo pominięte, bo starsze wersje mogą odrzucić cały plik ustawień z nieznanym kluczem. Dodaj je, gdy cały zespół ma nową wersję.
- Zmiany w `.claude/settings.json` i `.claude/hooks/` wprowadzasz ręcznie – Claude może je tylko zaproponować.
