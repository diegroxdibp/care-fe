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

## C. Services and target audiences

Decided 2026-10-20 (product owner). Most of this section is **not built yet** — item 18 lists the gap.

9. **The service list is shared by all of Care and grows by approval.** A professional can propose a new
   service; the Care team approves or rejects it. Once approved it joins the list, every professional can offer
   it, and the professional who proposed it has it switched on. Until then nobody (including the proposer) can
   use it in a slot. Does the design cover proposing, the "waiting for approval" state, approval, and rejection
   (with what the professional is told in each case)?
10. **Each service in the list says how it can be offered: individual, group, or both.** This is set in the
    proposal and approved with it. A "both" service is a single entry — not two.
11. **Target audiences** (público-alvo — for example adults, teenagers, couples) are also a shared list that grows
    by approval, the same way as services: proposed, approved by the Care team, then available to everyone.
    Each service in the list has **mandatory** audiences (anyone offering it serves them — Couples Therapy always
    serves couples) and **optional** ones (a professional chooses whether to offer them — an LGBT+ focus within
    Couples Therapy). A professional's offering always includes the mandatory audiences and any optional ones
    they pick. Does the design show the two kinds, and let the professional pick the optional ones?
12. **A slot is always one format — individual or group, never both.** A slot only offers services that allow
    its format: an individual slot lists services marked individual or both; a group slot, group or both. Every
    screen that lists services for a slot (the slot editor, Agendar, the invitation dialog) must filter this way.
13. **Modality** per service a professional offers: `ANY` (Qualquer), `LOCAL` (Presencial), `REMOTE` (Remoto).
    Does the design let a professional restrict a service to one modality?
14. **Turning a service off** (for one professional) hides it from their new slots and from Agendar; slots that
    already offer it keep it. Turning it back on reactivates the same service. The copy should say this.
15. **Prices are set on the slot, not on the service** (EUR required, BRL optional; an invitation can change
    them). A "create services" page that asks for a price is asking for something the backend ignores — either
    drop it or flag the backend change.
16. The existing UI is the "Serviços" section in the profile (`src/app/shared/components/services-settings/`),
    with one switch per format. Under item 10 it becomes one switch per service (with its formats shown).
    Does the new page replace it, reuse it, or link to it?
17. A professional with **no services** can't create a slot. Does the join flow make sure at least one service is
    on before sending them to Disponibilidade?
18. **Backend gap — what exists today versus what items 9–12 need:**
    - Today the list is a fixed enum (`SessionService` in care-be, `ProfessionalSessionService` in care-fe:
      `REICHIAN_BODY_ANALYSIS`, `MINDFULNESS`, `SOMATIC_EXPERIENCE`, `SUPERVISION`), with no audiences.
    - Today each professional has one row per name **and format** (`ProfessionalService`), so "both" is two rows;
      endpoints: `GET /api/services/mine`, `POST /api/services/create {name, modality, format}`,
      `PUT /api/services/enable|disable/{id}`.
    - Needed: a service list table (name, allowed formats, audiences, status), an audience list table, proposals
      with approve/reject (an admin screen and notifications to the proposer), professionals' services pointing
      at a list entry, and a migration that turns the 4 enum services and existing rows into list entries.
    - The design should be built against the new model; mark which screens depend on this backend work.

## D. What services unlock afterwards (so the copy doesn't promise something else)

19. **Slots** are individual (one client per date) or **group** (2 to 20 seats per date), and only offer services
    that allow their format (item 12). (`docs/adr/0001`.)
20. **Public or private**: public slots appear in Agendar; private ones only by invitation.
21. **Invitations** go to any email, including people without an account.
22. **Co-professionals** and **handing a slot over** exist; the profile name and photo are what other
    professionals see when choosing.

## E. Rules every new page must follow

23. **Design tokens only** — colors, fonts and spacing from `src/assets/styles/colors_and_type.css`
    (see `CLAUDE.md`). No hard-coded values.
24. **Copy in Brazilian Portuguese**, using the glossary's terms ("pessoa profissional", "pessoa cliente",
    "sessão", "vaga" in the UI).
25. **Times always in the viewer's profile time zone, never the computer's.** Use `timezones.util.ts`
    (`zonedWallTimeToInstant`, `wallTimeInZone`, `sessionZone`) and test Brazil (São Paulo) vs Portugal (Lisbon)
    in January and July.
26. **New routes reached from an email or while logged out** must be added to the return-path allowlist in both
    repos, or people land on the dashboard after logging in instead of on the page:
    `src/app/shared/utils/return-path.util.ts` (`RETURN_PATH_PATTERN`) and
    `../care-be/.../services/EmailConfirmationService.java` (`VALID_NEXT_PATTERN`).
27. **Public pages** (no login) go *before* the protected `''` route group in `app.routes.ts`, and any
    backend endpoint they call must be `permitAll` in `SecurityConfig` and exempt in `ProfileCompletionFilter`.
28. **Privacy**: never show one person's email, phone or clinical information to another, and never list clients
    to other clients.
29. **Light theme only** (see project memory "Care is light-theme only").
30. **Mobile**: works at phone width with no horizontal scroll.

## F. How to report

Return a table with one row per item: number, status (✅ ⚠️ ❌ ❓), where it is addressed, and a note.
Items marked ❓ go to the product owner before any code is written.
