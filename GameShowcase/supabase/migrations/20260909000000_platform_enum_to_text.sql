-- Platform: enum -> text, with stored values rewritten to IGDB's names.
--
-- IGDB tracks ~200 platforms and keeps adding them, so an enum would need a
-- schema migration per console. The app now searches IGDB's /platforms
-- endpoint, which makes IGDB the source of truth for platform names and leaves
-- this column storing whatever the user picked.
--
-- To reverse: swap the CASE arms, then recreate the enum from the old labels.
-- The mapping is one-to-one except 'Xbox', which already collapsed every Xbox
-- generation before this migration and is left alone (it is also a valid IGDB
-- platform name in its own right).

alter table public."Games"
    alter column "Platform" type text using "Platform"::text;

update public."Games"
set "Platform" = case "Platform"
    when 'PC'       then 'PC (Microsoft Windows)'
    when 'PS1'      then 'PlayStation'
    when 'PS2'      then 'PlayStation 2'
    when 'PS3'      then 'PlayStation 3'
    when 'PS4'      then 'PlayStation 4'
    when 'PS5'      then 'PlayStation 5'
    when 'PS Vita'  then 'PlayStation Vita'
    when 'PSP'      then 'PlayStation Portable'
    when 'Switch'   then 'Nintendo Switch'
    when 'Switch 2' then 'Nintendo Switch 2'
    when '3DS'      then 'Nintendo 3DS'
    when 'DS'       then 'Nintendo DS'
    when 'GBA'      then 'Game Boy Advance'
    when 'SNES'     then 'Super Nintendo Entertainment System'
    else "Platform"
end
where "Platform" is not null;

-- Nothing else references the type; this fails loudly if that stops being true.
drop type if exists public."Game Platform";
