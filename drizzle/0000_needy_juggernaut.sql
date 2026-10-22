CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `aircraft` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`registration_id` text DEFAULT '' NOT NULL,
	`serial_number` text DEFAULT '' NOT NULL,
	`initial_seconds` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aircraft_serial_unique` ON `aircraft` (`serial_number`) WHERE "aircraft"."serial_number" <> '';--> statement-breakpoint
CREATE TABLE `flight` (
	`id` text PRIMARY KEY NOT NULL,
	`aircraft_id` text NOT NULL,
	`pilot_id` text NOT NULL,
	`source` text NOT NULL,
	`source_key` text,
	`log_file_name` text,
	`takeoff_at` integer NOT NULL,
	`landing_at` integer NOT NULL,
	`duration_sec` integer NOT NULL,
	`time_zone` text DEFAULT 'Asia/Tokyo' NOT NULL,
	`takeoff_lat` real,
	`takeoff_lng` real,
	`landing_lat` real,
	`landing_lng` real,
	`takeoff_place` text DEFAULT '' NOT NULL,
	`landing_place` text DEFAULT '' NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`specific_flights` text DEFAULT '[]' NOT NULL,
	`route` text DEFAULT '' NOT NULL,
	`safety_notes` text DEFAULT '' NOT NULL,
	`remarks` text DEFAULT '' NOT NULL,
	`max_height` real,
	`max_distance` real,
	`max_speed` real,
	`total_distance` real,
	`battery_start` integer,
	`battery_end` integer,
	`battery_serial` text,
	`warnings` text DEFAULT '[]' NOT NULL,
	`weather` text,
	`track` text DEFAULT '[]' NOT NULL,
	`signed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`aircraft_id`) REFERENCES `aircraft`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`pilot_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flight_source_key_idx` ON `flight` (`source_key`);--> statement-breakpoint
CREATE INDEX `flight_aircraft_takeoff_idx` ON `flight` (`aircraft_id`,`takeoff_at`);--> statement-breakpoint
CREATE INDEX `flight_pilot_idx` ON `flight` (`pilot_id`);--> statement-breakpoint
CREATE TABLE `log_file` (
	`id` text PRIMARY KEY NOT NULL,
	`sha256` text NOT NULL,
	`file_name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`log_version` integer NOT NULL,
	`keychains` text,
	`uploaded_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `log_file_sha256_unique` ON `log_file` (`sha256`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `squawk` (
	`id` text PRIMARY KEY NOT NULL,
	`aircraft_id` text NOT NULL,
	`flight_id` text,
	`occurred_on` text NOT NULL,
	`description` text NOT NULL,
	`action_on` text,
	`action` text,
	`confirmer` text,
	`reported_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`aircraft_id`) REFERENCES `aircraft`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`flight_id`) REFERENCES `flight`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reported_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `squawk_aircraft_idx` ON `squawk` (`aircraft_id`,`occurred_on`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'pilot' NOT NULL,
	`license_number` text,
	`signature` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);