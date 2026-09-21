-- Event discovery foundation: visual identity + structured geography.
-- Intentionally additive. Larger features (sessions, waitlists, networking,
-- communities, feedback, certificates and impact reporting) remain future modules.
begin;

alter table events
  add column cover_image_url text,
  add column event_format text not null default 'offline'
    check (event_format in ('offline', 'online', 'hybrid')),
  add column country_code text,
  add column region text,
  add column city text,
  add column latitude double precision,
  add column longitude double precision;

alter table events
  add constraint events_latitude_range
    check (latitude is null or latitude between -90 and 90),
  add constraint events_longitude_range
    check (longitude is null or longitude between -180 and 180),
  add constraint events_coordinates_pair
    check ((latitude is null) = (longitude is null));

create index events_discovery_idx
  on events(status, start_date, city)
  where status = 'PUBLISHED';

comment on column events.cover_image_url is
  'Event-specific poster/cover; distinct from workspace or event logo.';
comment on column events.event_format is
  'Discovery format: offline, online, or hybrid.';
comment on column events.latitude is
  'Optional map coordinate for event discovery; stored separately from venue/address.';
comment on column events.longitude is
  'Optional map coordinate for event discovery; stored separately from venue/address.';

commit;
