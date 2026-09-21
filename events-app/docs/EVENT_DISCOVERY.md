# Event discovery and future Events modules

## Implement now / next UI layer

The Events data model supports a distinct event poster/cover and structured geography:
- `cover_image_url`
- `event_format`: `offline | online | hybrid`
- `country_code`, `region`, `city`
- existing venue/address fields
- optional `latitude` + `longitude` for an interactive map

These fields are deliberately event-scoped. Workspace branding remains separate.

The public discovery experience should use only `PUBLISHED` events and can expose:
1. upcoming event cards (cover, title, organizer, date, city/online);
2. past events as evidence of platform activity;
3. format/geography filters;
4. a map when coordinates are present.

## Future — preserve extension points, do not build yet

Do not overload the `events` table with future workflow state. Add dedicated module tables when these features are implemented:

- sessions / personal agenda / session check-in;
- waitlist and admission offers;
- attendee visibility, contact exchange and networking preferences;
- event community/discussion layer;
- feedback and polls;
- badges and certificates;
- automated impact/attendance reporting.

The long-term relationship remains:

`Workspace -> People / CRM Organizations -> Events -> Registrations -> Tickets -> Check-ins`

Future modules may append Activities against the same Person instead of creating parallel contact records. This keeps ProMedia Events compatible with the wider ProMedia Platform/CRM for media and civil-society organizations.

## Privacy defaults

Exact venue coordinates are optional. Public discovery must not infer or publish coordinates from private CRM data. Attendee discovery/networking must be opt-in when implemented.
