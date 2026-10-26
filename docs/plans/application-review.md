# Application review, interview and request tracking

Implements the design handoff `src/design-system/reference/design_handoff_fluxo_care` (2026-10-26) on top of the
service catalogue (`service-catalogue.md`). What it adds to that plan: the team reviews an application or a
service proposal **part by part** with a conversation under each part, decides **each item** separately, and an
approved application is published only **after an interview** the person books themselves.

## Decisions

- A **request** is an application (profile + the proposals it brought) or a standalone proposal from someone who is
  already a professional. Both are reviewed the same way.
- **Points**: each part of the proposed page (`pro:quem-sou`, `pro:como-trabalho`, `pro:formacao`, `pro:outras-info`,
  `svc:{id}:apresentacao|caracteristicas|para-quem|especialidades`) has a status (pending / approved / denied) set by
  the team, and comments from both sides. `geral` holds the general comments (no status). Empty parts are not points.
- **Items**: the profile and each proposal get their own decision. Approving needs every point of the item approved
  and, for a proposal, every proposed audience decided. Rejecting the profile rejects its proposals.
- **Proposed audiences** are approved (optionally renamed) or rejected in the review; the decision is applied when the
  proposal is published (rejected ones leave the service).
- **Slugs** are set by the team in the review, before publishing.
- **Conclude** with every item decided. Profile rejected → everything rejected (final). Profile approved → interview
  to book; nothing is published yet. Standalone proposal → published or rejected at once.
- **Return for changes**: the person edits the same application (`/junte-se/pedido`, proposals updated by id) or
  proposal (`/dashboard/servicos/propor?rever=:id`) and sends it again; the review continues with its points and
  conversations. A rejected application sent again starts a new review.
- **Reopen** only while nothing has been applied: returned for changes, or concluded with the interview not booked.
- **Interviews** use a private catalogue service **"Entrevista"** (V44, `care_service.interview`). Team members (ADMIN)
  offer it in Perfil → Serviços and open private slots with it in Disponibilidade. The person books a date from
  `/meus-pedidos`; it is a normal appointment (host email, video room, reminders). Changing the time books the new one
  first, then cancels the old one. Cancelling the appointment anywhere puts the interview back to "to book".
  "Entrevista realizada · Publicar" publishes the profile (role, slug, offerings) and the approved proposals.
- Routes: `/admin/pedidos` (queue), `/admin/pedidos/:candidatura|proposta/:id` (team review, full width),
  `/meus-pedidos`, `/meus-pedidos/:tipo/:id` (tracking), `/meus-pedidos/:tipo/:id/pedido` (the full request with the
  conversation). The handoff's `/equipa/aprovacao` and anonymous `?modo=candidatura` were not adopted: the team area
  stays at `/admin`, and applying still needs an account (decided 2026-10-20).
- Emails: the person on each stage change and on each team comment; `admin@` on submissions, revisions, replies and
  bookings.

## Not done

- Agendar (`scheduling.component`) still has its own date field and slot cards; `AvailabilityPickerComponent` recreates
  them for the interview. Moving Agendar onto the picker is a separate change.
- Dev profile (H2, no Flyway) seeds the interview service, a Thursday interview slot and a client
  (`marta@example.com`) in `CareBeApplication`.

## Release

care-be V44 + endpoints and care-fe screens go together: the old `POST /api/admin/applications|services/{id}/approve`
and `/reject` are gone. Applications already pending on staging simply show as "Em análise" with no points decided.
