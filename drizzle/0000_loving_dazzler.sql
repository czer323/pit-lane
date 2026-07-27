CREATE TABLE `car_snapshots` (
	`snapshot_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`car_id` integer NOT NULL,
	`snapshot_date` text NOT NULL,
	`motor` text,
	`pinion` integer,
	`crown` integer,
	`gear_ratio` real,
	`tire_dia_mm` real,
	`rollout` real,
	`weight_g` integer,
	`notes` text,
	FOREIGN KEY (`car_id`) REFERENCES `cars`(`car_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_car_snapshots_car_date` ON `car_snapshots` (`car_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `cars` (
	`car_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`body` text,
	`body_type` text,
	`chassis` text,
	`weight_g` integer,
	`motor` text,
	`amp_draw_3v` real,
	`pinion` integer,
	`crown` integer,
	`gear_ratio` real,
	`tire_dia_mm` real,
	`rollout` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cars_name_unique` ON `cars` (`name`);--> statement-breakpoint
CREATE TABLE `events` (
	`event_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_date` text NOT NULL,
	`track` text NOT NULL,
	`session_label` text,
	`temperature_f` integer,
	`humidity_pct` integer,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_events_natural` ON `events` (`event_date`,`track`,`session_label`);--> statement-breakpoint
CREATE TABLE `runs` (
	`run_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`car_id` integer NOT NULL,
	`car_version_id` integer,
	`lane` text,
	`session_type` text NOT NULL,
	`round` integer,
	`rt` real,
	`sixty_ft` real,
	`three30_ft` real,
	`et` real,
	`mph` real,
	`dial_in` real,
	`win` integer,
	`temperature_f` integer,
	`humidity_pct` integer,
	`comments` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`event_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`car_id`) REFERENCES `cars`(`car_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`car_version_id`) REFERENCES `car_snapshots`(`snapshot_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_runs_session_type" CHECK(session_type IN ('Practice', 'Elimination')),
	CONSTRAINT "ck_runs_lane" CHECK(lane IS NULL OR lane IN ('Left', 'Right'))
);
--> statement-breakpoint
CREATE INDEX `idx_runs_event` ON `runs` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_car` ON `runs` (`car_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_car_et` ON `runs` (`car_id`,`et`);--> statement-breakpoint
CREATE VIEW `run_details` AS 
SELECT
    r.run_id,
    e.event_date,
    e.track,
    e.session_label,
    c.name AS car_name,
    r.lane,
    r.session_type,
    r.round,
    r.rt,
    r.sixty_ft,
    r.three30_ft,
    r.et,
    r.mph,
    r.dial_in,
    r.win,
    r.comments,
    cs.motor AS snapshot_motor,
    cs.gear_ratio AS snapshot_gear_ratio,
    cs.rollout AS snapshot_rollout,
    cs.pinion AS snapshot_pinion,
    cs.crown AS snapshot_crown,
    cs.tire_dia_mm AS snapshot_tire_dia_mm,
    cs.weight_g AS snapshot_weight_g,
    cs.notes AS snapshot_notes
FROM runs r
JOIN cars c ON r.car_id = c.car_id
JOIN events e ON r.event_id = e.event_id
LEFT JOIN car_snapshots cs ON coalesce(
    r.car_version_id,
    (SELECT snapshot_id FROM car_snapshots
     WHERE car_id = c.car_id AND snapshot_date <= e.event_date
     ORDER BY snapshot_date DESC, snapshot_id DESC LIMIT 1)
) = cs.snapshot_id
;