export const up = function (knex) {
  return knex.schema
    .createTable("users", (table) => {
      table.increments("id");
      table.text("username").notNullable().unique();
      table.text("password_hash").notNullable();
      table.text("user_type").notNullable().checkIn(["admin", "student"]);
      table.boolean("is_consented").notNullable();
      table.boolean("is_active").notNullable();

      table.index("username");
      table.index("user_type");
    })
    .createTable("classes", (table) => {
      table.increments("id");
      table.text("name").notNullable();
      table.text("description").nullable();
      table
        .text("status")
        .notNullable()
        .checkIn(["inactive", "in progress", "completed"]);
      table.datetime("created_at").notNullable();
    })
    .createTable("class_enrollments", (table) => {
      table.increments("id");
      table.integer("user_id").notNullable();
      table.integer("class_id").notNullable();

      table.foreign("user_id").references("users.id").onDelete("CASCADE");
      table.foreign("class_id").references("classes.id").onDelete("CASCADE");

      table.unique(["user_id", "class_id"]);

      table.index("user_id");
      table.index("class_id");
    })
    .createTable("groups", (table) => {
      table.increments("id");
      table.integer("class_id").notNullable();

      table.foreign("class_id").references("classes.id").onDelete("CASCADE");
    })
    .createTable("group_assignments", (table) => {
      table.increments("id");
      table.integer("user_id").notNullable();
      table.integer("group_id").notNullable();

      table.unique(["user_id", "group_id"]);

      table.foreign("group_id").references("groups.id").onDelete("CASCADE");
      table.foreign("user_id").references("users.id").onDelete("CASCADE");

      table.index("user_id");
      table.index("group_id");
    })
    .createTable("rounds", (table) => {
      table.increments("id");
      table.integer("round_number").notNullable();
      table.integer("group_id").notNullable();
      table.boolean("is_active");
      table.datetime("started_at").nullable();
      table.datetime("completed_at").nullable();

      table.foreign("group_id").references("groups.id").onDelete("CASCADE");

      table.unique(["group_id", "round_number"]);

      table.index("group_id");
    })
    .createTable("prompts", (table) => {
      table.increments("id");
      table.text("instructions").notNullable();
      table.text("condensed_instructions").notNullable();
      table.text("category").notNullable();
      table.boolean("is_for_receiver").notNullable();
    })
    .createTable("round_assignments", (table) => {
      table.increments("id");
      table.integer("user_id").notNullable();
      table.integer("round_id").notNullable();
      table.integer("prompt_id").notNullable();
      table.boolean("is_active");

      table.foreign("user_id").references("users.id").onDelete("CASCADE");
      table.foreign("round_id").references("rounds.id").onDelete("CASCADE");
      table.foreign("prompt_id").references("prompts.id").onDelete("CASCADE");

      table.unique(["user_id", "round_id"]);

      table.index("user_id");
      table.index("round_id");
      table.index("prompt_id");
      table.index("is_active");
    })
    .createTable("messages", (table) => {
      table.increments("id");
      table.integer("user_id").notNullable();
      table.integer("recipient_id").notNullable();
      table.integer("round_id").notNullable();
      table.text("subject").notNullable();
      table.text("body").notNullable();
      table.text("visualization").nullable();
      table.text("cell_id").nullable();
      table.datetime("timestamp").notNullable();

      table.foreign("user_id").references("users.id").onDelete("CASCADE");
      table.foreign("recipient_id").references("users.id").onDelete("CASCADE");
      table.foreign("round_id").references("rounds.id").onDelete("CASCADE");

      table.index("user_id");
      table.index("recipient_id");
      table.index("round_id");
      table.index("timestamp");
    })
    .createTable("round_outcomes", (table) => {
      table.increments("id");
      table.integer("round_id").notNullable();
      table.integer("winner_user_id").notNullable();
      table.text("justification").notNullable();
      table.datetime("created_at").notNullable();
      table.foreign("round_id").references("rounds.id").onDelete("CASCADE");
      table
        .foreign("winner_user_id")
        .references("users.id")
        .onDelete("CASCADE");
    })
    .createTable("notebooks", (table) => {
      table.increments("id");
      table.integer("round_assignment_id").notNullable().unique();
      table.datetime("created_at").notNullable();
      table.datetime("last_modified_at").notNullable();
      table
        .foreign("round_assignment_id")
        .references("round_assignments.id")
        .onDelete("CASCADE");

      table.index("round_assignment_id");
    })
    .createTable("audit_logs", (table) => {
      table.increments("id");
      table.datetime("timestamp").notNullable();
      table.integer("user_id").notNullable();
      table.text("action").notNullable();
      table.text("entity_type").notNullable();
      table.integer("entity_id").nullable();
      table.text("metadata").nullable(); // JSON

      table.foreign("user_id").references("users.id").onDelete("CASCADE");

      table.index("user_id");
      table.index("action");
      table.index("entity_type");
      table.index("entity_id");
      table.index("timestamp");
    })
    .createTable("notebook_snapshots", (table) => {
      table.increments("id");
      table.integer("notebook_id").notNullable();
      table.integer("audit_log_id").nullable(); // Link to audit log
      table.datetime("timestamp").notNullable();
      table.integer("version").notNullable();
      table.text("cells_order").notNullable();
      table
        .text("change_type")
        .notNullable()
        .checkIn([
          "cell_added",
          "cell_deleted",
          "cell_reordered",
          "save",
          "execution",
          "initialization",
        ]);

      table
        .foreign("notebook_id")
        .references("notebooks.id")
        .onDelete("CASCADE");
      table
        .foreign("audit_log_id")
        .references("audit_logs.id")
        .onDelete("SET NULL");

      table.unique(["notebook_id", "version"]);
      table.index("notebook_id");
      table.index("audit_log_id");
      table.index("timestamp");
    })
    .createTable("cell_states", (table) => {
      table.increments("id");
      table.text("cell_id").notNullable();
      table.text("cell_type").notNullable().checkIn(["code", "raw"]);
      table.text("source_hash").notNullable();
      table.text("source").notNullable();
      table.datetime("created_at").notNullable();

      table.unique(["cell_id", "source_hash"]);
      table.index("cell_id");
      table.index("source_hash");
    })
    .createTable("snapshot_cells", (table) => {
      table.integer("snapshot_id").notNullable();
      table.integer("cell_state_id").notNullable();
      table.integer("position").notNullable();
      table
        .foreign("snapshot_id")
        .references("notebook_snapshots.id")
        .onDelete("CASCADE");

      table
        .foreign("cell_state_id")
        .references("cell_states.id")
        .onDelete("CASCADE");

      table.primary(["snapshot_id", "cell_state_id"]);
      table.index("snapshot_id");
      table.index("cell_state_id");
    })
    .createTable("cell_executions", (table) => {
      table.increments("id");
      table.integer("snapshot_id").notNullable();
      table.integer("cell_state_id").notNullable();
      table.datetime("timestamp").notNullable();
      table.text("status").notNullable().checkIn(["success", "error"]);
      table.text("context").nullable();

      table
        .foreign("snapshot_id")
        .references("notebook_snapshots.id")
        .onDelete("CASCADE");
      table
        .foreign("cell_state_id")
        .references("cell_states.id")
        .onDelete("CASCADE");

      table.index("snapshot_id");
      table.index("cell_state_id");
      table.index("timestamp");
      table.index("status");
    });
};

export const down = function (knex) {
  return knex.schema
    .dropTableIfExists("cell_executions")
    .dropTableIfExists("snapshot_cells")
    .dropTableIfExists("cell_states")
    .dropTableIfExists("notebook_snapshots")
    .dropTableIfExists("notebooks")
    .dropTableIfExists("round_outcomes")
    .dropTableIfExists("messages")
    .dropTableIfExists("round_assignments")
    .dropTableIfExists("prompts")
    .dropTableIfExists("rounds")
    .dropTableIfExists("data_files")
    .dropTableIfExists("group_assignments")
    .dropTableIfExists("groups")
    .dropTableIfExists("class_enrollments")
    .dropTableIfExists("classes")
    .dropTableIfExists("audit_logs")
    .dropTableIfExists("users");
};
