# Shared service list, target audiences and offerings: implementation plan

Terms follow `GLOSSARY.md` (service, format, target audience, offering, service proposal). Decided with the
product owner on 2026-10-20; the design side is tracked in `docs/checklists/join-us-and-services.md` (section C).

## What changes, in one paragraph

Today services are a fixed list in code (4 names) and each professional has one row per name **and** format.
After this work, Care has a **shared service list** that grows when the Care team approves a professional's
**proposal**. Each service says which **formats** it allows (individual, group, or both) and which **target
audiences** it serves — some **mandatory** (everyone offering it serves them), some **optional** (each
professional chooses). Each professional has one **offering** per service they provide: which of its allowed
formats, which optional audiences, which modality, on or off. A slot is always exactly one format and only offers
services whose offering includes that format.

## Release order

Phases 1–3 of the group-sessions plan are on staging and **not** on production. Their "Serviços" section and
format checks use the old model, so this work ships **before** anything goes to production: production goes
straight to the new model, and never gets a services screen that is replaced a week later.

Work ships in three steps, all on staging first:

| Step | Size | What |
|---|---|---|
| 1 | Large | Backend: data model, migration of existing data, catalogue/proposal/offering APIs, slot rules |
| 2 | Large | Frontend: offerings editor, proposal form, admin approval screen, slot editor and Agendar on the new model |
| 3 | Medium | Names from the list everywhere (emails, sessions, records), replacing the code enums |

---

## Step 1 — Backend

### Data model (migration V38)

- `service` — the shared list: `id`, `name_pt`, `name_en` (nullable; falls back to `name_pt`), `description`,
  `allows_individual`, `allows_group`, `status` (`PENDING` | `APPROVED` | `REJECTED`), `proposed_by`,
  `created_at`, `reviewed_by`, `reviewed_at`, `review_note`.
- `target_audience` — the shared list of audiences: `id`, `name_pt`, `name_en`, `status`, `proposed_by`,
  review fields as above.
- `service_audience` — `service_id`, `audience_id`, `mandatory` (boolean). Primary key on the pair.
- `professional_service` becomes the **offering** (same table, so every foreign key from slots, appointments,
  invitations and reschedule requests keeps working):
  - add `service_id` (→ `service`), `offers_individual`, `offers_group`;
  - keep `modality`, `active`, `professional_id`;
  - new uniqueness: one offering per professional + service + modality;
  - `offering_audience` — `offering_id`, `audience_id`: the optional audiences this professional chose.
- After the data is moved: drop `professional_service.session_format` and `professional_service.name`.

### Moving today's data (same migration, in order)

1. Insert the 4 current services as `APPROVED` list entries, with their Portuguese and English names from
   `SessionService` / `messages`. Both formats allowed, so nothing that exists today becomes invalid.
2. Point every `professional_service` row at its list entry by name.
3. Merge rows that only differed by format (same professional + name + modality) into one offering:
   `offers_individual` / `offers_group` from which rows existed and were active. Repoint
   `availability_services`, `appointment`, `invitation` and `reschedule_request` from the removed duplicates to
   the kept row, then delete the duplicates.
4. Production only has individual rows today, so there it is a straight one-to-one move; staging also has the
   group rows created during testing.

### Rules

- A proposal creates a `PENDING` service (and any new `PENDING` audiences it names). Nobody can offer it until it
  is `APPROVED`.
- Approval (role `ADMIN`):
  - approves the service and the new audiences it brought;
  - the admin can fix the names and add the English name;
  - creates the proposer's offering switched on, with every allowed format and no optional audiences picked;
  - notifies the proposer (notification + email).
- Rejection: the service and its new audiences become `REJECTED`, with a note shown to the proposer.
- An offering's formats must be a subset of the service's; its optional audiences a subset of the service's
  optional audiences. Mandatory audiences are always included and can't be removed.
- A slot's format must be offered by every offering it lists (replaces today's per-row format check).
- Turning a format off in an offering is refused while a future slot of that format offers it, naming the slot
  (same idea as changing a slot's format).
- A service already approved can't be deleted in this version (nothing asks for it yet).

### Endpoints

- `GET /api/catalogue/services` — approved services with formats and audiences (mandatory/optional). Public
  (Agendar and the join-us pages need it before login).
- `GET /api/catalogue/audiences` — approved audiences. Public.
- `POST /api/catalogue/proposals` — professional: `{ namePt, nameEn?, description?, allowsIndividual,
  allowsGroup, audiences: [{ audienceId? , newAudienceNamePt?, mandatory }] }`.
- `GET /api/catalogue/proposals/mine` — professional: their proposals and status.
- `GET /api/catalogue/proposals` — admin: pending proposals.
- `POST /api/catalogue/proposals/{id}/approve` `{ namePt?, nameEn?, audienceNames? }` and
  `POST /api/catalogue/proposals/{id}/reject` `{ note }` — admin.
- `GET /api/offerings/mine` — professional: their offerings (on and off).
- `PUT /api/offerings/{serviceId}` — professional: `{ offersIndividual, offersGroup, modality,
  optionalAudienceIds, active }`, create or update.
- The current `/api/services/mine|create|enable|disable` are removed in the same release (only the profile's
  Serviços section uses them, and it is rebuilt in step 2).

### Tests

- Migration: a professional with an individual and a group row of the same service ends with one offering
  offering both, and every slot, appointment and invitation still points at a row that exists.
- Proposal → approval → the proposer can create a slot with it; before approval, refused.
- Offering rules: formats and optional audiences outside the service's are refused; mandatory audiences can't be
  dropped; a format in use by a future slot can't be turned off.
- Slot rule: a group slot refuses an offering without group; an individual slot refuses one without individual.

---

## Step 2 — Frontend

- **Profile → Serviços** becomes the offerings editor:
  - each approved service with an on/off switch;
  - the formats it allows (individual and/or group);
  - its optional audiences as chips to pick, and the mandatory ones shown as fixed;
  - the modality.
- **Propor um serviço** (from the same section):
  - name;
  - description;
  - which formats;
  - audiences from the list, or new ones, each marked mandatory or optional.

  Below the form, the professional's proposals with their status and the Care team's note.
- **Admin → Pedidos de serviços** (new, role `ADMIN`): pending proposals with approve (adjusting names and the
  English name) or reject (with a note). The app has no admin area today; this is its first screen, behind a
  new admin guard.
- **Slot editor**: the services list is the professional's active offerings that include the slot's format.
- **Agendar**: the service picker comes from the shared list (one entry per service, no duplicates per format);
  each slot card shows its format; the professional card shows the audiences they serve.
- **Invitation dialog**: services filtered by the slot's format, as in the slot editor.
- **Join-us pages** (being designed in another session): consume the public catalogue endpoints and the
  proposal endpoint.

## Step 3 — Names from the list

Service names come from the code today: `SessionService.labelFor` in 6 places in care-be (emails, messages) and
the `ProfessionalSessionService` map in 11 files in care-fe. They switch to the list's name, in the reader's
language (`name_en` falling back to `name_pt`). The DTOs that carry a service id also carry its name, so screens
stop looking names up.

---

## Open points (with the default this plan uses)

1. **English names**: proposals are in Portuguese; the admin adds the English name on approval, and English
   readers see the Portuguese name until then. Default: as described.
2. **Agendar filtering by audience** (a client picks "casais" and sees only professionals serving couples):
   default is to show audiences on the professional card in this step, and add filtering later.
3. **Withdrawing an approved service from the list**: not in this version.
