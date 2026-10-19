# A group is a session with seats, on a slot that is either individual or group

Care needed group sessions alongside individual ones. We model a group session as an ordinary session that more than one client can attend, up to a capacity set on its availability slot, and every slot is fixed as either individual or group. Clients relate to a group only through their seat on a date, or their series in that slot (members); drop-ins take a single date's seat.

## Considered Options

- **A lasting "group" with its own members, separate from sessions.** Rejected for now: it needs membership management screens that nothing asks for yet, and a member can already be expressed as a series in a group slot. It can be added on top later.
- **A slot offering both individual and group services, decided by the first booking.** Rejected: whoever booked first would silently decide what the slot is for everyone else, and capacity would change meaning from date to date.

- **One appointment holding an array of clients.** Rejected: members and drop-ins don't share a timeline (a member from a date until they leave, a drop-in on one date, each with their own cancelled dates, deadlines, emails and records), so the array would grow into a second appointment model and every per-client flow would be rewritten against it.

## Consequences

- Each client keeps their own appointment (a series for a member, a single date for a drop-in). A group session record per slot and date holds what the group shares: the date moved or cancelled by the owner, the call extension, that date's co-professionals. Clients' appointments follow it. An individual session is the case with one client and no group session record.
- Code that assumed one appointment per slot and date goes through one "who is on this slot on this date" helper that returns a list.
- "Slot taken on a date" becomes "slot full on a date": an individual slot is full with one client, a group slot at its capacity.
- Switching a slot between individual and group is refused while it has future sessions.
