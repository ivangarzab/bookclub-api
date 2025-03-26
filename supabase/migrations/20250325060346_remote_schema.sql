alter table "public"."shamelist" drop constraint "shamelist_session_id_fkey";

alter table "public"."shamelist" drop constraint "shamelist_pkey";

drop index if exists "public"."shamelist_pkey";

alter table "public"."clubs" add column "discord_channel" bigint;

alter table "public"."discussions" alter column "date" drop not null;

alter table "public"."discussions" alter column "date" set data type date using "date"::date;

alter table "public"."members" drop column "numberofbooksread";

alter table "public"."members" add column "books_read" integer default 0;

alter table "public"."sessions" drop column "defaultchannel";

alter table "public"."sessions" drop column "duedate";

alter table "public"."sessions" add column "due_date" date;

alter table "public"."shamelist" drop column "session_id";

alter table "public"."shamelist" add column "club_id" text not null;

CREATE UNIQUE INDEX shamelist_pkey ON public.shamelist USING btree (club_id, member_id);

alter table "public"."shamelist" add constraint "shamelist_pkey" PRIMARY KEY using index "shamelist_pkey";

alter table "public"."shamelist" add constraint "shamelist_club_id_fkey" FOREIGN KEY (club_id) REFERENCES clubs(id) not valid;

alter table "public"."shamelist" validate constraint "shamelist_club_id_fkey";


