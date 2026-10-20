# Care

Care connects professionals and their clients for therapy sessions: professionals open availability, clients book sessions, and sessions happen in person or by video.

## Scheduling

**Availability slot**:
A time a professional opens for sessions, once or on a repeating pattern. A slot is either for individual sessions or for group sessions, never both.
_Avoid_: Block, opening, horário (in code: Availability)

**Public slot**:
An availability slot that any client can find and book in Agendar. Slots are public unless made private.
_Avoid_: Open slot

**Private slot**:
An availability slot hidden from Agendar, which clients can only join through an invitation from the professional.
_Avoid_: Hidden slot, closed slot

**Session**:
One meeting at a date and time, attended by one or more professionals and one or more clients.
_Avoid_: Appointment (in conversation), meeting, call

**Individual session**:
A session for one client.

**Group session**:
A session that more than one client can attend, up to the slot's capacity.
_Avoid_: Group (on its own), class, workshop

**Capacity**:
The maximum number of clients a group slot accepts per date, chosen by the professional for that slot.
_Avoid_: Limit, size, max participants

**Seat**:
One client's place in a group session on a given date.
_Avoid_: Spot, vacancy, booking

**Series**:
A repeating commitment by a client to a slot (weekly, biweekly or monthly) until they leave or it is changed.
_Avoid_: Recurrence, recurring appointment

**Member**:
A client with a series in a group slot, expected at every one of its sessions until they leave.
_Avoid_: Regular, subscriber

**Drop-in**:
A client who takes a seat in a recurring group session for a single date, without being a member.
_Avoid_: Guest, one-off, visitor

**Invitation**:
A professional's offer to a client of a seat on one date or a series in one of their slots, which the client accepts or declines.
_Avoid_: Proposal, convite de sessão, offer

**Co-professional request**:
A professional's offer to another professional to join a slot, session or series as co-professional.
_Avoid_: Invitation (for professionals), co-host invite

**Commitment**:
A co-professional's place in a session they don't own, which makes them busy at that time without being part of their availability.
_Avoid_: Booking, external session

## Services

**Service**:
A kind of therapy or practice in Care's shared list (for example Mindfulness), which says whether it can be offered individually, in a group, or both, and to which target audiences.
_Avoid_: Modality (that is in person or remote), specialty, offering

**Format**:
Whether a session is individual or group. A service can allow both; a slot is always exactly one.
_Avoid_: Type, kind, mode

**Target audience**:
A group of people a service is meant for (for example adults, teenagers, couples), from a shared list. For each service an audience is either mandatory (everyone offering the service serves it) or optional (each professional chooses).
_Avoid_: Público (in code), segment, demographic

**Offering**:
A professional's version of a service: which of its formats they offer, which of its optional audiences, and in which modality.
_Avoid_: Professional service (in conversation), my service

**Service proposal**:
A professional's request to add a new service or target audience to the shared list, approved or rejected by the Care team.
_Avoid_: Suggestion, service request

## People

**Professional**:
A practitioner who runs sessions. A session can have more than one.
_Avoid_: Therapist, provider, profissional (in code)

**Owner**:
The professional an availability slot belongs to, who alone can change, reschedule or cancel its sessions. Ownership can be handed to another professional.
_Avoid_: Creator, host, main professional

**Co-professional**:
A professional who takes part in a slot's sessions, or in one session or series, without owning it.
_Avoid_: Co-host, co-therapist, guest professional

**Client**:
A person who attends sessions.
_Avoid_: Patient, user, customer
