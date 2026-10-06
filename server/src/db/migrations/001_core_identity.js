/**
 * Core identity layer: wards, users, sessions, audit log.
 * Portable across SQLite (development) and PostgreSQL (production).
 */
export async function up(knex) {
  // ── Wards / village divisions ────────────────────────────────────────────
  await knex.schema.createTable('wards', (t) => {
    t.increments('id').primary();
    t.string('name', 120).notNullable();
    t.string('code', 24).notNullable().unique();
    t.string('village', 120);
    t.string('description', 255);
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at');
  });

  // ── Users (citizen | officer | admin) ────────────────────────────────────
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('name', 120).notNullable();
    t.string('email', 160).notNullable().unique();
    t.string('mobile', 15).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.string('ration_number', 32).unique();
    t.string('role', 24).notNullable().defaultTo('citizen'); // citizen | officer | admin
    t.integer('ward_id').unsigned().references('id').inTable('wards').onDelete('SET NULL');
    t.string('address', 255);
    t.string('avatar_url', 255);
    t.string('designation', 120);
    t.string('status', 16).notNullable().defaultTo('active'); // active | inactive | suspended
    t.string('preferred_language', 8).notNullable().defaultTo('en');
    t.string('timezone', 64).notNullable().defaultTo('Asia/Kolkata');
    t.timestamp('last_login_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at');
    t.index(['role', 'status'], 'users_role_status_idx');
    t.index(['ward_id'], 'users_ward_idx');
  });

  // ── Refresh-token sessions (revocable, powers "session management") ───────
  await knex.schema.createTable('sessions', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('refresh_token_hash', 128).notNullable().unique();
    t.string('user_agent', 255);
    t.string('ip_address', 64);
    t.timestamp('expires_at').notNullable();
    t.timestamp('revoked_at');
    t.timestamp('last_seen_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'revoked_at'], 'sessions_user_idx');
  });

  // ── Audit trail for privileged / security-relevant actions ───────────────
  await knex.schema.createTable('audit_logs', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    t.string('action', 80).notNullable();
    t.string('entity', 60);
    t.string('entity_id', 60);
    t.text('meta');
    t.string('ip_address', 64);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['entity', 'entity_id'], 'audit_entity_idx');
    t.index(['created_at'], 'audit_created_idx');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('wards');
}
