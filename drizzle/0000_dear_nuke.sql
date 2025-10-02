CREATE TABLE "machine_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"machine_type" text DEFAULT 'laser_engraver' NOT NULL,
	"serial_connection" text DEFAULT 'COM4',
	"baud" integer DEFAULT 250000,
	"preamble" text DEFAULT 'G1 Z60',
	"postamble" text DEFAULT '(postamble)',
	"shape_preamble" text DEFAULT 'G1 Z60',
	"shape_postamble" text DEFAULT 'G1 Z60',
	"coordinates" text DEFAULT 'absolute',
	"units" text DEFAULT 'points',
	"auto_scale" boolean DEFAULT false,
	"optimise" boolean DEFAULT true,
	"line_speed" integer DEFAULT 2000,
	"curve_speed" integer DEFAULT 2000,
	"draw_speed" integer DEFAULT 2000,
	"travel_speed" integer DEFAULT 2000,
	"feed_rate" integer DEFAULT 3000,
	"draw_height" integer DEFAULT 0,
	"travel_height" integer DEFAULT 26,
	"z_travel" real DEFAULT 3,
	"z_draw" real DEFAULT 0,
	"z_lift" real DEFAULT 2,
	"z_refill" integer DEFAULT 20,
	"z_color" integer DEFAULT 18,
	"z_start" integer DEFAULT 19,
	"z_center" integer DEFAULT 15,
	"z_end" integer DEFAULT 19,
	"laser_power" integer DEFAULT 1000,
	"layer_height" real DEFAULT 0.15,
	"print_accel" integer DEFAULT 3000,
	"travel_accel" integer DEFAULT 2000,
	"max_jerk" integer DEFAULT 200,
	"layers" integer DEFAULT 1,
	"bed_max_x" integer DEFAULT 300,
	"bed_max_y" integer DEFAULT 300,
	"x_offset" integer DEFAULT 0,
	"y_offset" integer DEFAULT 0,
	"scale_f" real DEFAULT 0.72,
	"origin_point" text DEFAULT 'bottom-left',
	"smoothness" real DEFAULT 0.34,
	"connect_tolerance" real DEFAULT 0.001,
	"refill_pos_x" integer DEFAULT 150,
	"refill_pos_y" integer DEFAULT 10,
	"refill_pos_z" integer DEFAULT 20,
	"refill_length" integer DEFAULT 200,
	"refill" boolean DEFAULT false,
	"gradient_length_mm" integer DEFAULT 8,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer,
	"is_connected" boolean DEFAULT false,
	"last_connected_at" timestamp,
	"connection_error" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "machine_connections_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"svg_data" text,
	"fabric_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"theme" text DEFAULT 'dark',
	"grid_size" integer DEFAULT 5,
	"snap_enabled" boolean DEFAULT true,
	"show_rulers" boolean DEFAULT true,
	"show_grid" boolean DEFAULT true,
	"default_machine_config" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "machine_configs" ADD CONSTRAINT "machine_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_connections" ADD CONSTRAINT "machine_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_connections" ADD CONSTRAINT "machine_connections_profile_id_machine_configs_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."machine_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_machine_config_machine_configs_id_fk" FOREIGN KEY ("default_machine_config") REFERENCES "public"."machine_configs"("id") ON DELETE no action ON UPDATE no action;