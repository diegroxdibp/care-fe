# Shared service list, professional profiles and applications: implementation plan

Terms follow `GLOSSARY.md` (service, private service, format, modality, target audience, specialty, offering,
service proposal, service change proposal, application, personal profile, professional profile). Decided with the
product owner on 2026-10-20, in two sessions: the catalogue model first, then crossing it with the design handoff
from Claude Design ("Páginas dinâmicas de serviços": service page, professional page, service form, professional
form, combined preview, Junte-se a nós). The handoff's HTML files are a visual reference, not code to copy.

## What changes, in one paragraph

Today services are a fixed list in code (4 names), each professional has one row per name **and** format, the
public service pages and the three `/bio/...` pages are hard-coded components, and nobody can become a
professional without an admin. After this work Care has a **shared service list** that grows by approval, each
service has a **public page** generated from its data, each professional has a **professional profile** (public
page, separate from their personal profile), and anyone with an account can send an **application** to become a
professional, optionally proposing services in the same form. The Care team reviews everything in a new **admin
area**.

## Decisions (2026-10-20)

**Services**
- A service says which **formats** (individual, group), **modalities** (in person, remote) and **visibilities**
  (public slots, private slots) it allows — one or both of each. A slot is always exactly one of each.
- A **private service** (allows private slots only) is reached only by invitation: it has no Agendar button and is
  left out of the service lists and professional profiles; its page is reachable by its link only.
- A service's own **target audiences are mandatory**. **Specialties** (name, optional description, their own
  audiences) bring the **optional** audiences. An offering picks which specialties it offers.
- Public page content belongs to the service: intro (paragraphs), quote, image + alt text, "Para quem pode fazer
  sentido" (one item per line), specialties.
- **Service change proposals**: a professional who offers a service can propose changes to it (one pending per
  person per service); the admin approves or rejects with a note. Admins edit directly. Approval and direct edits
  run the same checks: removing a format / modality / visibility / specialty in use is refused naming who uses it;
  adding a mandatory audience to a service that already has offerings is refused (add it as a specialty).
- New **target audiences** can be proposed inside any service or specialty; they are approved with it.
- **Languages** (PT, ES, EN, FR, IT) are a fixed list managed by admins; no proposals.
- The page address (**slug**) is generated from the name and set by the admin on approval; old slugs keep
  redirecting.

**People**
- To **apply**, a person signs up or logs in first (onboarding already collects time zone, currency, language).
  The application is their professional profile plus the existing services they offer (checkboxes) plus any
  number of service proposals. One application at a time. While waiting the person is still a client and sees
  "Pedido em análise"; rejected → sees the note, can edit and send again; approved → notification + email, the
  professional role is added and the professional profile is published.
- The admin decides each item separately: the application, then each proposal. A proposal can only be approved
  once its proposer is a professional. Rejecting the application rejects its proposals.
- Approving an application turns each ticked service into an **offering** switched on with every allowed format
  and modality and no specialties; the professional fine-tunes it in Perfil → Serviços.
- **Professional profile** — separate from the personal profile, with its own **display name** (defaults to the
  account name), photo, title, "Quem sou", quote, education, experience, "Como trabalho", languages, areas,
  other information. Modalities, formats and audiences shown on it are **derived** from the offerings. It is used
  wherever the person appears as a professional (their page, service pages, Agendar, co-professional picker,
  clients' session lists, video call); the personal profile everywhere else.
- After approval professionals edit their professional profile without review; **every save that changes
  something emails `admin@careclinica.com`** with the profile, its link and each changed field as before → after.
  The same address gets an email for each new application, service proposal and service change proposal.
- The admin can **hide** a professional profile (page returns not found; the person leaves Agendar and the
  service pages; existing sessions untouched).
- Existing professionals start with an empty, unpublished professional profile; until it is filled they are left
  out of `/profissionais` and the service pages but stay bookable in Agendar (account name and photo as fallback).
  Luane's hard-coded bio is seeded into her profile (slug `luane`), linked to her account when one professional
  account's name starts with "Luane", otherwise left unattached for the admin to attach. Rayssa's and Yara's pages
  are dropped.

**Site**
- New public routes: `/servicos/:slug`, `/profissionais`, `/profissionais/:slug`, `/junte-se`. Old routes
  (`/atendimento/individual/analise-reichana`, `/mindfulness`, `/somatic-experience`,
  `/for-professionals/supervision`, `/bio/luane`) redirect; the hard-coded pages' content is seeded into the list.
  `/atendimento/individual` and `/atendimento/grupo` list the services allowing that format (private ones left out).
- **Portuguese only** for now (sessions can be held in other languages; that is what "Idiomas" means). No English
  names or content.
- Drafts of the forms stay in the browser until sent.
- Images: JPG / PNG / WebP up to 15 MB, reduced to ≤1200 px on the longest side in the browser and again on the
  server (Cloudinary).

## Status (2026-10-20)

- **Done, committed locally, not pushed:** steps 1–5. care-be `b4d4858`, `0fb8a3a`, `2eb748c` (V38 and V39
  tested on a real Postgres in `MigrationsTest`, entities validated against them); care-fe `ac4a444` and the
  step 5 commit.
- Step 5 also covers the professional profile's display name and photo wherever someone appears as a
  professional (session lists, video call, co-professional picker, emails and notifications to clients). Greetings
  in emails sent to the professional keep the account name.
- Service names are Portuguese only (the list has no English names), so English emails show the Portuguese name.
- **Left:** check everything end to end on staging.

## Release order

Phases 1–3 of the group-sessions plan are on staging and **not** on production. This work ships to staging in the
steps below and goes to production **all at once**, together with group sessions, so production never sees the old
services screen.

| Step | What |
|---|---|
| 1 | Backend: list, offerings, professional profiles, applications, proposals, change proposals, admin endpoints, data migration and seeding, admin emails, slot rules |
| 2 | Public pages: service, professional, lists, Junte-se, redirects |
| 3 | Forms: application (with proposals), professional profile editor, Perfil → Serviços (offerings + proposals + change proposals), slot editor / Agendar / invitation dialog on the new model |
| 4 | Admin area: Pedidos, Serviços, Profissionais |
| 5 | Names from the list everywhere (emails, sessions, records) replacing the code enums |

Steps 1 and 3 change the same API the current screens use, so they reach staging together.

---

## Step 1 — Backend

### Data model (migration V38)

- `care_service` — the shared list: `slug` (unique), `name`, `status` (`PENDING` | `APPROVED` | `REJECTED`),
  `allows_individual`, `allows_group`, `allows_in_person`, `allows_remote`, `allows_public`, `allows_private`,
  `intro`, `quote`, `image_url`, `image_alt`, `for_whom`, `legacy_key` (the old enum key, for the 4 existing
  ones), `proposed_by`, `application_id`, `created_at`, `reviewed_by`, `reviewed_at`, `review_note`.
- `target_audience` — `name`, `status`, `proposed_by`, review fields. `care_service_audience` — the service's
  (mandatory) audiences.
- `service_specialty` — `service_id`, `name`, `description`, `position`; `specialty_audience`.
- `care_language` — `code`, `name`; seeded PT, ES, EN, FR, IT.
- `professional_service` becomes the **offering** (same table, so every foreign key from slots, appointments,
  invitations and reschedule requests keeps working): add `care_service_id`, `offers_individual`, `offers_group`;
  `session_modality` stays (ANY = both); `offering_specialty`; one offering per professional + service. `name`
  keeps the service's key until step 5; `session_format` is dropped.
- `professional_profile` — `user_id` (nullable only for the unattached Luane seed), `slug`, `display_name`, `title`,
  `photo_url`, `who_am_i`, `quote`, `education`, `experience`, `how_i_work`, `areas`, `other_info`,
  `status` (`DRAFT` | `PUBLISHED` | `HIDDEN`), `updated_at`; `professional_profile_language`.
- `professional_application` — `user_id`, `status`, `created_at`, review fields; `application_service` (the
  ticked existing services).
- `service_change_proposal` — `service_id`, `proposed_by`, `content` (the proposed service, JSON), `status`,
  `created_at`, review fields.

### Moving today's data (same migration)

1. Insert the 4 current services as approved list entries with their page content from the hard-coded components,
   allowing both formats, both modalities and both visibilities, so nothing that exists becomes invalid.
2. Point every `professional_service` row at its entry by name; merge rows of the same professional + service
   (formats from the rows that existed and were active; modality ANY when they differed); repoint
   `availability_services`, `appointment`, `invitation`, `reschedule_request` to the kept row.
3. Create an empty draft professional profile per professional; seed Luane's.

### Endpoints

Public (`permitAll`, exempt in `ProfileCompletionFilter`):
- `GET /api/catalogue/options` — approved audiences, languages.
- `GET /api/catalogue/services?format=` — approved, listable services (no private-only).
- `GET /api/catalogue/services/{slug}` — page data, with the professionals offering it (published profiles,
  derived formats / modalities / audiences); private-only services reachable here.
- `GET /api/professionals`, `GET /api/professionals/{slug}` — published profiles with derived data and listable
  services.

Signed in:
- `POST /api/catalogue/images` — upload a service image, returns its URL.
- `GET|PUT /api/applications/mine`, `POST /api/applications/mine/submit`, `POST /api/applications/mine/photo`.
- `GET|PUT /api/professional-profile/mine`, `POST .../photo` — professional.
- `GET /api/offerings/mine`, `PUT /api/offerings/{serviceId}` — professional.
- `POST /api/catalogue/proposals`, `GET /api/catalogue/proposals/mine` — professional.
- `POST /api/catalogue/services/{id}/change-proposals`, `GET /api/catalogue/change-proposals/mine` — offerers.

Admin (`ADMIN`):
- `GET /api/admin/requests` — pending applications, service proposals, change proposals.
- `POST /api/admin/applications/{id}/approve {slug}` / `reject {note}`.
- `POST /api/admin/services/{id}/approve {slug, …edits}` / `reject {note}`.
- `POST /api/admin/change-proposals/{id}/approve` / `reject {note}`.
- `GET /api/admin/services`, `PUT /api/admin/services/{id}`.
- `GET /api/admin/professionals`, `PUT /api/admin/professionals/{profileId}`, `…/hide`, `…/show`, `…/attach`.

The current `/api/services/create|enable|disable` are removed; `/api/services/mine` and `/getAll` return offerings
in the new shape until step 5.

### Rules

- Nobody can offer a service that is not approved.
- An offering's formats and modality must be allowed by its service; its specialties must be the service's.
- A slot's format, modality and visibility must be allowed by every service it lists, and its format offered by
  every offering it lists.
- Turning a format off in an offering is refused while a future slot of that format offers it, naming the slot.

### Tests

Migration merge; proposal → approval → slot; offering and slot rules; change-proposal checks; application approval
(role added, profile published, offerings created); profile-change email diff; public endpoints never expose email
or phone.

## Steps 2–5

Frontend work follows the handoff layout and its README rules, using the design tokens in
`colors_and_type.css` (adding `--fg-muted-2: #6f7789` and `--color-error-soft: #fbefee`), the existing header and
footer, `_service-page.scss`, `[@expandCollapse]` for accordions, and `Pages` for routes. Previews never navigate.
Admin area behind a new admin guard. Step 5 replaces `SessionService.labelFor` (care-be) and the
`ProfessionalSessionService` map (care-fe) with the list's names and drops `professional_service.name`.
