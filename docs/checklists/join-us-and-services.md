# Checklist: "Join us" (professional sign-up) and creating services

For whoever designs or builds these pages. Go through every item and mark it:

- ✅ **covered** — say where in the design (page, section, component);
- ⚠️ **partly covered** — say what is missing;
- ❌ **not covered** — say why (out of scope, decided against, forgot);
- ❓ **needs a decision** — the item says whose decision.

Read first: `GLOSSARY.md` (the words to use), `docs/adr/0001-group-session-is-a-session-with-seats.md`,
`docs/adr/0002-co-professional-time-is-a-commitment-not-availability.md`, and `docs/plans/group-sessions.md`.
Use the glossary's terms in page copy and in code; avoid the words it lists under _Avoid_.

The backend is the sibling repo `../care-be` (Spring Boot). "Exists" below means it is built and on staging,
not yet on production.

---

## A. Becoming a professional

1. ❓ **There is no self-service way to become a professional today.** Sign-up (`/auth/signup`) and onboarding
   (`PUT /api/user/onboarding`) always create a client account. The professional role is only granted by an
   admin through `POST /api/user/addRole` (`UserController`, admin-only). The design must say which of these it
   assumes, and the product owner must confirm it:
   - **(a)** an application that the Care team reviews and approves (needs a new "pending professional" state,
     an admin screen, and emails to both sides — none exist);
   - **(b)** instant professional account on sign-up (no review — a clinical platform may not want this);
   - **(c)** the page only collects interest (a contact form) and the team grants the role as today
     (`POST /api/contact` exists and is public).
2. Everything a professional sees (Disponibilidade, Meus atendimentos, Salas, Clientes) is gated by
   `AvailabilityAccessGuard` and backend `@PreAuthorize` on the roles `PROFESSIONAL` / `THERAPIST` / `ADMIN`.
   A design that lands a new professional on those pages must account for the role being granted first.
3. Existing accounts: a person who already has a **client** account and becomes a professional keeps the same
   account and email. Does the design handle "I already have an account"?

## B. What every professional profile must have

4. **Time zone** — required. Every slot a professional creates is stored in their profile time zone; sessions are
   shown to each person in their own zone (see the Sept/Oct 2026 incidents in project memory). The flow must
   collect it (onboarding already does: `timeZone`, defaulting to the browser's).
5. **Currency** (EUR or BRL) — required by onboarding.
6. **Language** (pt-BR or en) — onboarding accepts it.
7. **Name, photo, bio** — the only things other professionals see when choosing a co-professional
   (`GET /api/co-professionals/professionals` returns id, name, photo, bio — never email or phone).
   Clients see name, photo and bio in Agendar. Does the design set expectations about what is public?
8. Phone and birth date are collected at onboarding but are **never** shown to other users. The design must not
   suggest otherwise.

## C. Services

9. **Services come from a fixed Care catalogue**, not free text: `REICHIAN_BODY_ANALYSIS`, `MINDFULNESS`,
   `SOMATIC_EXPERIENCE`, `SUPERVISION` (frontend `ProfessionalSessionService` enum with display names; backend
   `SessionService` enum). A design that lets professionals invent services needs a backend change — flag it.
10. **Each service is offered as Individual, Group, or both.** One row per name + format + modality
    (`ProfessionalService`). Group versions are what group slots can offer.
11. **Modality** per service: `ANY` (Qualquer), `LOCAL` (Presencial), `REMOTE` (Remoto). The current Serviços
    section creates services as `ANY`. Does the design let a professional restrict a service to one modality?
12. **Turning a service off** hides it from new slots and from Agendar; slots that already offer it keep it.
    Turning it back on reactivates the same service (not a duplicate). The copy should say this.
13. **Prices are set on the slot, not on the service.** `CreateProfessionalServiceDTO` has no price; the slot
    editor and the invitation dialog carry EUR (required) and BRL (optional). A "create services" page that asks
    for a price is asking for something the backend ignores — either drop it or flag the backend change.
14. Endpoints that exist (professional roles only, and only on your own services):
    - `GET /api/services/mine` — your services, on and off;
    - `POST /api/services/create` `{ name, modality, format }` — create, or reactivate if it existed;
    - `PUT /api/services/enable/{id}`, `PUT /api/services/disable/{id}`.
15. The existing UI for this is the "Serviços" section in the profile
    (`src/app/shared/components/services-settings/`). Does the new page replace it, reuse it, or link to it?
16. A professional with **no services** can't create a slot. Does the join flow make sure at least one service is
    on before sending them to Disponibilidade?

## D. What services unlock afterwards (so the copy doesn't promise something else)

17. **Slots** are individual (one client per date) or **group** (2 to 20 seats per date). Group slots only offer
    group services. (`docs/adr/0001`.)
18. **Public or private**: public slots appear in Agendar; private ones only by invitation.
19. **Invitations** go to any email, including people without an account.
20. **Co-professionals** and **handing a slot over** exist; the profile name and photo are what other
    professionals see when choosing.

## E. Rules every new page must follow

21. **Design tokens only** — colors, fonts and spacing from `src/assets/styles/colors_and_type.css`
    (see `CLAUDE.md`). No hard-coded values.
22. **Copy in Brazilian Portuguese**, using the glossary's terms ("pessoa profissional", "pessoa cliente",
    "sessão", "vaga" in the UI).
23. **Times always in the viewer's profile time zone, never the computer's.** Use `timezones.util.ts`
    (`zonedWallTimeToInstant`, `wallTimeInZone`, `sessionZone`) and test Brazil (São Paulo) vs Portugal (Lisbon)
    in January and July.
24. **New routes reached from an email or while logged out** must be added to the return-path allowlist in both
    repos, or people land on the dashboard after logging in instead of on the page:
    `src/app/shared/utils/return-path.util.ts` (`RETURN_PATH_PATTERN`) and
    `../care-be/.../services/EmailConfirmationService.java` (`VALID_NEXT_PATTERN`).
25. **Public pages** (no login) go *before* the protected `''` route group in `app.routes.ts`, and any
    backend endpoint they call must be `permitAll` in `SecurityConfig` and exempt in `ProfileCompletionFilter`.
26. **Privacy**: never show one person's email, phone or clinical information to another, and never list clients
    to other clients.
27. **Light theme only** (see project memory "Care is light-theme only").
28. **Mobile**: works at phone width with no horizontal scroll.

## F. How to report

Return a table with one row per item: number, status (✅ ⚠️ ❌ ❓), where it is addressed, and a note.
Items marked ❓ go to the product owner before any code is written.
