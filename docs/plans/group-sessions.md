# Group sessions, private slots and co-professionals: implementation plan

Terms follow `GLOSSARY.md`. Decisions behind the shape: `docs/adr/0001` (a group is a session with seats) and `docs/adr/0002` (a co-professional's time is a commitment).

Work ships in four phases. Each phase is deployable on its own and leaves the app working; nothing of a later phase is visible before it ships. Every phase touches both repos, includes a Flyway migration, and needs its own push approval.

---

## How the data is shaped

**Each client keeps their own appointment, as today.** A member is a recurring appointment in a group slot; a drop-in is a one-off appointment in it. Everything that is per client keeps working unchanged: cancelling a date (exceptions), the 24-hour rule, emails in each client's language and time zone, the client record, messages, and the event history.

**A group session record holds what the group shares.** One row per group slot and date (`group_session`), created the first time that date needs one: when its first seat is taken, or the owner acts on the date. It holds:
- the date's state: scheduled, moved (with the new date and times) or cancelled by the owner;
- the call extension for that date;
- that date's co-professionals (phase 3).

Clients' appointments follow it. If the group session for 23/10 is moved to 24/10 at 18:00, every client with a seat on 23/10 shows and joins at 24/10 18:00, without touching their appointments. If it is cancelled, nobody has that date. Group-level actions are one change on one row, not one per client.

The Daily room belongs to the slot (`slot-{id}`), created once and sized at capacity plus professionals; each participant's token is limited to the group session's window.

**"Taken" becomes "full".** Today any appointment on a date makes the slot taken, and some code assumes there is at most one appointment per slot and date (for example the calendar's `bookedSlotsForBlock` takes the first one it finds). Phase 2 replaces that with one shared helper in each repo, "who is on this slot on this date", which returns a list. Every check uses it: booking, invitations, series proposals and changes, booked dates in Agendar, the calendar and the panels. A slot is **full** on a date when that list reaches its capacity. An individual slot has capacity 1, so it behaves as it does today.

**Moving a group date stays inside the owner's availability**, as rescheduling an individual session does today: the owner picks a free date and time in one of their group slots with enough capacity for everyone with a seat (ADR 0002: the owner's sessions always sit in the owner's availability).

---

## Phase 0: Prerequisites (small)

These touch the same tables and flows the later phases build on, so they go first.

1. **Fill in missing time zones and make them required.**
   - Migration: copy each appointment's zone from its slot, then from the professional's profile, then Europe/Lisbon; do the same for slots. Then `NOT NULL` on both columns.
   - Frontend: drop the "no zone, use the computer's clock" fallbacks (`sessionBounds`, `isWallTimePast`, `resolveOccurrenceDisplay`), and fix the two open spots (`dashboard.component.ts` `sessionDateTime`, `availability.component.ts` `isApptPast`).
2. **Return to any app link after login or sign-up**, so an invitation link survives login, sign-up with confirmation, onboarding and Google. Before this, only Agendar links came back; every other link landed on the dashboard, and onboarding always dropped it.
3. **Ship the pending dashboard overtime change** (the yellow "Entrar · prolongada até" button), already built and tested locally.

---

## Phase 1: Private slots and email invitations (medium)

Value: professionals can run slots that clients can't find in Agendar, and invite anyone by email, including people without an account. Works for individual slots, before groups exist.

**Database**
- `availability.visibility` (`PUBLIC` | `PRIVATE`, default `PUBLIC`, existing rows `PUBLIC`).
- New `invitation` table: slot, professional, invited email, client (null until an account with that email exists), kind (`DATE` | `SERIES`), date or series start and frequency, service, modality, price terms, free-text message, status (`PENDING` | `ACCEPTED` | `DECLINED` | `WITHDRAWN` | `EXPIRED`), expires at.

**Backend**
- Agendar's slot search leaves out private slots; booking a private slot directly is refused.
- Create, withdraw, list, accept and decline invitations. Accepting creates the client's appointment, after checking the seat is still free.
- An invitation expires when its date starts (or, for a series, when its first date starts).
- When an account confirms an email that has pending invitations, they are attached to it.
- Emails for invitations to existing users and to non-users (with the sign-up link and the message), in Portuguese and English.

**Frontend**
- Slot editor: "Pública / Privada" switch.
- Invite dialog: free-text email field next to today's client list, plus a message field. It replaces the current proposal dialog.
- An invitation page that opens from the email link. When not logged in, it goes to login or sign-up and back to the invitation; sign-up arrives with the invited email filled in and locked.
- Disponibilidade and dashboards show pending invitations where pending proposals show today.

**Transition:** proposals already pending when this ships stay as they are until answered; new ones are invitations. "Proposta" disappears from the UI.

**Reserving:** an invitation to an individual slot reserves that slot until it is answered, withdrawn or expires, as a pending proposal does today; no second invitation or booking can take it meanwhile. Invitations to a group slot don't hold seats: whoever accepts first gets the seat.

---

## Phase 2: Group slots and seats (large)

**Database**
- `availability.session_format` (`INDIVIDUAL` | `GROUP`, existing rows `INDIVIDUAL`) and `availability.capacity` (1 for individual; 2 to 20 for group).
- Room fields on the slot for group rooms (`video_room_name`, `video_room_url`).
- New `group_session` table: slot, date (in the slot's time zone), status (`SCHEDULED` | `MOVED` | `CANCELLED`), new date and start and end time when moved, extra call minutes, reason. Unique on slot and date.

**Backend**
- Profile services: "Grupo" switch per service, creating the group version (`ProfessionalServiceService.create` already accepts the format).
- Slot rules:
  - A group slot only offers group services.
  - Capacity can be at most 20.
  - Lowering capacity below a future date's seats is refused, naming the date.
  - Switching format is refused while the slot has future sessions.
- Occupancy:
  - One helper, "who is on this slot on this date", returns the list of client appointments occurring that date, following the group session (a moved date counts at its new date; a cancelled one counts nobody).
  - Every "is this slot taken" check becomes "is it full", through that helper.
  - These are booking, invitations, series proposals and changes, and the booked dates Agendar shows.
  - It comes back as seats taken and left per date.
- Drop-in booking in Agendar; membership only through an invitation of kind `SERIES`.
- Group dates:
  - The owner moves or cancels a group date directly: one change to its group session, notified to every client with a seat that date.
  - A move targets a free date and time in one of the owner's group slots with enough capacity for everyone with a seat.
  - Clients cancel their own seat (24-hour rule).
  - Members leave from a date.
  - The owner removes a member or a drop-in, with a reason.
- Video:
  - Group room per slot, sized capacity plus professionals.
  - Every client with a seat on that date gets a token; professionals get moderation.
  - Extending is stored on the group session for that date.
- Notifications: the owner gets notifications and emails; clients get notifications and emails about their own seat and about group date changes.

**Frontend**
- Profile: "Individual / Grupo" switches per service.
- Slot editor: format, capacity, and only matching services.
- Disponibilidade:
  - The calendar reads the per-date list from the shared helper, never "the first appointment".
  - Group bands show "Grupo · 6/8".
  - The session panel lists the date's clients (to the professional only) with remove actions.
  - Moving or cancelling a group date asks once and covers everyone.
- Agendar: "Grupo" tag, seats left per date, full dates shown as full.
- Client dashboard:
  - The session shows "Grupo · N participantes", never other clients' names.
  - Cancel only offers "cancel my seat"; members also get "leave the group".
- Call: group room, moderation (mute and remove) for professionals, as in Salas.

---

## Phase 3: Co-professionals and ownership transfer (large)

**Database**
- `co_professional_request`: from, to, target (slot, appointment or series, or one group session), from date, status, expires at.
- `slot_co_professional`, `appointment_co_professional` and `group_session_co_professional`: professional, from date, until date (one date for a group session).
- `ownership_transfer_request`: slot, from, to, whether the old owner stays, status.

**Backend**
- Requests:
  - Sending is blocked when the invitee has a booked session that clashes, with an option to message them.
  - Accepting is blocked while any clash exists.
  - A request expires like an invitation.
- Commitments:
  - Conflict checks include a professional's commitments.
  - Accepting closes the co-professional's own public slot at that time for that date; leaving reopens it.
- Co-professionals:
  - They leave, or are removed, from a date.
  - They see the session, get in-app notifications, and join the call with moderation, but can't move or cancel.
- Ownership transfer:
  - The receiver accepts, and the busy check applies.
  - The slot and its appointments move to the new owner.
  - The old owner stays as co-professional if chosen.
  - Clients are told of the new main professional.
- Lists, emails and the client's care team show every professional in a session.

**Frontend**
- Add co-professional to a slot, or to a session or series; send, withdraw and answer requests.
- Commitments on the calendar, in their own style, marked "com {owner}".
- Transfer ownership dialog and request.
- Session panels, dashboards and calls show all professionals.

---

## Testing

- Every phase follows the standing timezone rule: Brazil (São Paulo) versus Portugal (Lisbon), in January and July, and the browser-zone suites.
- Phase 2 adds capacity edge cases: last seat taken by two clients at once (row lock on the slot, as booking does today), a member's cancelled date reused by a drop-in, and lowering capacity.
- Phase 3 adds clashes in both directions, and the slot closing and reopening around a commitment.

## Order and size

| Phase | Size | Ships |
|---|---|---|
| 0 | Small | Time zones always present, Google `next`, overtime button |
| 1 | Medium | Private slots, invitations by email |
| 2 | Large | Group slots, seats, drop-ins, members, group calls |
| 3 | Large | Co-professionals, commitments, ownership transfer |
