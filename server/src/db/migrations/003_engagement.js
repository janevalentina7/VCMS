/**
 * Engagement + configuration layer: notifications, application settings,
 * notification preferences.
 */
export async function up(knex) {
  await knex.schema.createTable('notifications', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('complaint_id').unsigned().references('id').inTable('complaints').onDelete('CASCADE');
    t.string('complaint_ref', 32);
    t.string('type', 40).notNullable(); // complaint_registered | complaint_assigned | status_updated | complaint_resolved | complaint_rejected | remark_added | user_welcome
    t.string('title', 140).notNullable();
    t.string('message', 400).notNullable();
    t.string('severity', 16).notNullable().defaultTo('info'); // info | success | warning | error
    t.string('link', 200);
    t.boolean('is_read').notNullable().defaultTo(false);
    t.timestamp('read_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'is_read'], 'notifications_user_idx');
    t.index(['created_at'], 'notifications_created_idx');
  });

  await knex.schema.createTable('settings', (t) => {
    t.increments('id').primary();
    t.string('key', 80).notNullable().unique();
    t.string('value', 500);
    t.string('label', 160);
    t.string('group', 60).notNullable().defaultTo('general');
    t.string('type', 20).notNullable().defaultTo('string'); // string | boolean | number
    t.timestamp('updated_at');
    t.index(['group'], 'settings_group_idx');
  });

  await knex.schema.createTable('notification_preferences', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    t.boolean('complaint_notifications').notNullable().defaultTo(true);
    t.boolean('assignment_notifications').notNullable().defaultTo(true);
    t.boolean('resolution_notifications').notNullable().defaultTo(true);
    t.boolean('email_notifications').notNullable().defaultTo(false);
    t.boolean('sms_notifications').notNullable().defaultTo(false);
    t.timestamp('updated_at');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('notification_preferences');
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('notifications');
}
