/**
 * Complaint domain: categories, complaints, status history, officer assignments,
 * and the atomic complaint-number sequence used for VCMS-YYYY-000000 ids.
 */
export async function up(knex) {
  // ── Categories (database driven - admins can activate/deactivate) ─────────
  await knex.schema.createTable('categories', (t) => {
    t.increments('id').primary();
    t.string('name', 120).notNullable().unique();
    t.string('slug', 120).notNullable().unique();
    t.string('description', 255);
    t.string('icon', 40).defaultTo('CircleAlert');
    t.string('colour', 16).defaultTo('#1d4ed8');
    t.boolean('active').notNullable().defaultTo(true);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at');
  });

  // ── Atomic per-year sequence backing complaint reference numbers ──────────
  await knex.schema.createTable('complaint_counters', (t) => {
    t.integer('year').primary();
    t.integer('last_number').notNullable().defaultTo(0);
    t.timestamp('updated_at');
  });

  // ── Complaints ───────────────────────────────────────────────────────────
  await knex.schema.createTable('complaints', (t) => {
    t.increments('id').primary();
    t.string('complaint_id', 32).notNullable().unique(); // VCMS-2026-000001
    t.integer('citizen_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('category_id').unsigned().notNullable().references('id').inTable('categories').onDelete('RESTRICT');
    t.integer('ward_id').unsigned().references('id').inTable('wards').onDelete('SET NULL');

    t.string('citizen_name', 120).notNullable();
    t.string('ration_number', 32);
    t.string('mobile_number', 15).notNullable();

    t.text('description').notNullable();
    t.string('street_name', 160).notNullable();
    t.string('area', 160);
    t.string('location', 255).notNullable();
    t.decimal('latitude', 10, 7);
    t.decimal('longitude', 10, 7);
    t.string('image_url', 255);
    t.string('priority', 16).notNullable().defaultTo('medium'); // low | medium | high | critical
    t.string('status', 16).notNullable().defaultTo('pending'); // pending | in_progress | resolved | rejected

    t.integer('assigned_officer_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    t.integer('approved_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('approved_at');
    t.integer('resolved_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    t.integer('rejected_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    t.string('rejection_reason', 500);

    t.timestamp('complaint_date').notNullable();
    t.timestamp('resolution_date');
    t.text('remarks');
    t.text('resolution_remarks');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at');

    t.index(['status'], 'complaints_status_idx');
    t.index(['priority'], 'complaints_priority_idx');
    t.index(['category_id'], 'complaints_category_idx');
    t.index(['ward_id'], 'complaints_ward_idx');
    t.index(['assigned_officer_id'], 'complaints_officer_idx');
    t.index(['citizen_id'], 'complaints_citizen_idx');
    t.index(['complaint_date'], 'complaints_date_idx');
  });

  // ── Status / action history (every transition is recorded) ────────────────
  await knex.schema.createTable('complaint_history', (t) => {
    t.increments('id').primary();
    t.integer('complaint_id').unsigned().notNullable().references('id').inTable('complaints').onDelete('CASCADE');
    t.string('old_status', 16);
    t.string('new_status', 16);
    t.string('action', 60).notNullable();
    t.integer('changed_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    t.string('changed_by_role', 24);
    t.text('remarks');
    t.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    t.index(['complaint_id', 'timestamp'], 'history_complaint_idx');
  });

  // ── Officer assignments (kept as an append-only ledger) ──────────────────
  await knex.schema.createTable('officer_assignments', (t) => {
    t.increments('id').primary();
    t.integer('complaint_id').unsigned().notNullable().references('id').inTable('complaints').onDelete('CASCADE');
    t.integer('officer_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('assigned_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('unassigned_at');
    t.string('notes', 255);
    t.boolean('active').notNullable().defaultTo(true);
    t.index(['complaint_id', 'active'], 'assignments_complaint_idx');
    t.index(['officer_id', 'active'], 'assignments_officer_idx');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('officer_assignments');
  await knex.schema.dropTableIfExists('complaint_history');
  await knex.schema.dropTableIfExists('complaints');
  await knex.schema.dropTableIfExists('complaint_counters');
  await knex.schema.dropTableIfExists('categories');
}
