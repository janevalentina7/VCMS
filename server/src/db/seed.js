/**
 * Database seeding / reset utility.
 *
 *   npm run db:seed          → idempotent seed (safe to re-run, skips existing rows)
 *   npm run db:reset         → migrate:fresh + seed (drops every table first)
 *
 * The generated dataset is deliberately realistic (≈18 months of village
 * complaints with officer assignments, remarks, history and notifications) so
 * dashboards, charts and reports look meaningful in development.
 *
 * ⚠️  DEVELOPMENT CREDENTIALS ONLY - never ship these accounts to production.
 */
import { db, closeDatabase } from './index.js';
import config from '../config/env.js';
import { CATEGORY_SEED, WARD_SEED, ROLES, STATUS, PRIORITY, DEFAULT_SETTINGS } from '../config/constants.js';
import { hashPassword } from '../services/authService.js';
import { nextComplaintId } from '../utils/complaintId.js';
import { logger } from '../utils/logger.js';

const TENANT = 'Kattupakkam';
const SEED_PASSWORD = 'Password@123';
const ADMIN_PASSWORD = 'Admin@12345';
const OFFICER_PASSWORD = 'Officer@12345';
const CITIZEN_PASSWORD = 'Citizen@12345';

// Deterministic pseudo random generator so repeated seeds look consistent.
let seedState = 20260206;
const random = () => {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
};
const pick = (list) => list[Math.floor(random() * list.length) % list.length];
const intBetween = (min, max) => min + Math.floor(random() * (max - min + 1));
const chance = (probability) => random() < probability;

const CITIZENS = [
  ['Arun Kumar', 'TN123456789', '9876543210', 'arun.kumar@example.com', 4],
  ['Meena Lakshmi', 'TN223344556', '9845012345', 'meena.lakshmi@example.com', 1],
  ['Selvam Rajan', 'TN334455667', '9865123456', 'selvam.rajan@example.com', 2],
  ['Kavitha Devi', 'TN445566778', '9791234567', 'kavitha.devi@example.com', 3],
  ['Murugan Pillai', 'TN556677889', '9952078901', 'murugan.pillai@example.com', 5],
  ['Bhuvana Priya', 'TN667788990', '9445123456', 'bhuvana.priya@example.com', 4],
  ['Sundaram Iyer', 'TN778899001', '9600123456', 'sundaram.iyer@example.com', 6],
  ['Anjali Ramesh', 'TN889900112', '9789012345', 'anjali.ramesh@example.com', 2],
  ['Dinesh Kannan', 'TN990011223', '9345012345', 'dinesh.kannan@example.com', 3],
  ['Lakshmi Narayanan', 'TN101112233', '9566123456', 'lakshmi.narayanan@example.com', 1],
  ['Rajeshwari Sundar', 'TN112233445', '9840123456', 'rajeshwari.sundar@example.com', 5],
  ['Gopal Krishnan', 'TN122334455', '9445123987', 'gopal.krishnan@example.com', 6],
  ['Nithya Sree', 'TN132435465', '9791098765', 'nithya.sree@example.com', 2],
  ['Vignesh Balaji', 'TN142536475', '9842233445', 'vignesh.balaji@example.com', 4],
  ['Sangeetha Devi', 'TN152637485', '9952334455', 'sangeetha.devi@example.com', 3],
];

const OFFICERS = [
  ['Raj Kumar', 'raj.kumar@vcms.gov.in', '9444455566', 'TN555566677', 4, 'Assistant Engineer - Works'],
  ['Priya Anandan', 'priya.anandan@vcms.gov.in', '9445566778', 'TN666677788', 1, 'Sanitation Inspector'],
  ['Vetri Selvan', 'vetri.selvan@vcms.gov.in', '9446677889', 'TN777788899', 2, 'Junior Engineer - Water Works'],
  ['Kalaivani Ravi', 'kalaivani.ravi@vcms.gov.in', '9447788990', 'TN888899900', 4, 'Health Inspector'],
  ['Sathish Kumar', 'sathish.kumar@vcms.gov.in', '9448899001', 'TN999900011', 5, 'Revenue Officer'],
  ['Amudha Bharathi', 'amudha.bharathi@vcms.gov.in', '9449900112', 'TN100011122', 6, 'Ward Officer'],
];

const ADMINS = [
  ['Village Administrator', 'admin@vcms.gov.in', '9800000001', 'TN100000001', 'Village Administrative Officer'],
  ['Tharani Sekar', 'supervisor@vcms.gov.in', '9800000002', 'TN100000002', 'Block Development Officer'],
];

const STREETS = [
  ['Gandhi Street', 'Ward 4, Gandhi Street', 4],
  ['Bazaar Street', 'Ward 1, Bazaar Street', 1],
  ['Anna Nagar 2nd Cross', 'Ward 2, Anna Nagar', 2],
  ['Nehru Street', 'Ward 3, Nehru Street', 3],
  ['School Road', 'Ward 4, School Road', 4],
  ['Bharathi Street', 'Ward 5, Bharathi Street', 5],
  ['Lake View Street', 'Ward 6, Lake View Street', 6],
  ['Mariamman Kovil Street', 'Ward 3, Mariamman Kovil Street', 3],
  ['Kamaraj Street', 'Ward 2, Kamaraj Street', 2],
  ['Periyar Nagar Main Road', 'Ward 5, Periyar Nagar', 5],
  ['West Colony 3rd Lane', 'Ward 6, West Colony', 6],
  ['Temple Street', 'Ward 1, Temple Street', 1],
];

const DESCRIPTIONS = [
  ['water-supply', 'The drinking water pipeline near {street} has been leaking for {days} days. Water supply is getting contaminated and residents are facing difficulty in storing clean drinking water.'],
  ['water-supply', 'No drinking water supply in {street} for the past {days} days. The overhead tank valve seems to be closed and the motor is not functioning properly.'],
  ['road-damage', 'There is a large pothole on {street} which is causing accidents for two-wheeler riders. It becomes worse during rain and water stagnates inside it.'],
  ['road-damage', 'The cement road in {street} has collapsed near the drainage crossing and heavy vehicles passing through are damaging the remaining portion.'],
  ['street-light', 'The street light near the primary school in {street} has not been working for the past {days} days. Ladies and school children find it unsafe to walk in the evening.'],
  ['street-light', 'Three street light poles in {street} are not glowing at night since last week. Please replace the LED fittings and repair the switch box.'],
  ['garbage', 'Garbage has not been collected from {street} for {days} days and the bin is overflowing with waste. A very bad smell is spreading in the area and stray dogs are scattering the waste.'],
  ['garbage', 'Waste is being dumped illegally on the vacant land beside {street}. This needs to be cleared and a ban board should be fixed.'],
  ['drainage', 'The storm water drain in {street} is blocked with silt and plastic waste causing overflow on the road whenever it rains.'],
  ['drainage', 'Drainage water is stagnating on {street} for the last {days} days due to the damaged drain wall. Mosquitoes are breeding in the stagnant water.'],
  ['public-health', 'Mosquito breeding is noticed in the stagnant water near the community hall in {street}. Two children in the area are already suffering from fever.'],
  ['public-health', 'The primary health clinic in {street} has not received medicines for the weekly camp and several elderly patients were turned back.'],
  ['sanitation', 'The public toilet near the bus stand in {street} has not been cleaned for {days} days and the water supply is also not working.'],
  ['sanitation', 'Roadside cleaning is not happening in {street} and the entire stretch has become dirty with litter and plastic bags.'],
  ['other', 'Stray cattle are roaming on {street} and damaging the roadside plants and compound walls of nearby houses.'],
  ['other', 'The public park bench and play equipment in {street} are broken and need repair for the safety of children.'],
];

const REMARKS = [
  'Site inspected along with the assistant engineer. Measurement taken for the repair work.',
  'Work order prepared and the contractor has been informed to start the work within two days.',
  'Materials required for the repair have been requested from the block store.',
  'Private land issue identified. Revenue officer has been informed for a joint inspection.',
  'Temporary arrangement made. Permanent solution will be completed after the approval of funds.',
  'Work completed and the site has been handed over to the ward secretary.',
  'Complaint verified on site. The reported issue is not within the village panchayat limits.',
  'Duplicate complaint received earlier for the same location. Merged with the original complaint.',
];

const RESOLUTION_REMARKS = [
  'Pipeline repaired and the water supply has been restored. Residents confirmed normal supply.',
  'Pothole filled with concrete and the road is now motorable for all vehicles.',
  'LED street light fitting replaced and the pole is glowing properly since last night.',
  'Garbage cleared completely and the bin has been washed with bleaching powder. Daily collection route restored.',
  'Drain cleaned up to the outlet and the water logging problem has been resolved.',
  'Anti-larval spray carried out in the area and the stagnant water was drained. Awareness pamphlets distributed.',
  'Public toilet cleaned, water connection restored and the caretaker has been instructed to maintain a daily log.',
];

const REJECTION_REASONS = [
  'The reported location does not fall under this village panchayat limit. Forwarded details to the concerned block office for necessary action.',
  'The complaint is a duplicate of an existing complaint registered for the same location and issue.',
  'The reported issue was already resolved by the department before the complaint was registered. Verified on site with photographs.',
  'Insufficient location details. The complainant could not identify the exact spot even after two follow-up calls.',
];

const dateNDaysAgo = (days, hour = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, intBetween(0, 59), 0, 0);
  return d;
};

const truncateAll = async () => {
  const tables = [
    'notifications',
    'notification_preferences',
    'audit_logs',
    'complaint_history',
    'officer_assignments',
    'complaints',
    'complaint_counters',
    'sessions',
    'settings',
    'categories',
    'wards',
    'users',
  ];
  for (const table of tables) {
    await db(table).del();
  }
  if (config.db.client === 'pg') {
    // Reset identity sequences so a fresh seed starts from id 1.
    for (const table of ['users', 'complaints', 'categories', 'wards', 'notifications', 'complaint_history', 'officer_assignments']) {
      await db.raw('ALTER SEQUENCE ?? RESTART WITH 1', [`${table}_id_seq`]).catch(() => {});
    }
  } else {
    await db.raw("DELETE FROM sqlite_sequence WHERE name IN ('users','complaints','categories','wards','notifications','complaint_history','officer_assignments','sessions','audit_logs')").catch(() => {});
  }
};

const seedWards = async () => {
  await db('wards').insert(
    WARD_SEED.map((ward) => ({
      name: `${ward.name} — ${TENANT}`,
      code: ward.code,
      village: ward.village,
      description: ward.description,
      active: true,
      created_at: new Date(),
    })),
  );
  return db('wards').orderBy('code');
};

const seedCategories = async () => {
  await db('categories').insert(
    CATEGORY_SEED.map((category, index) => ({
      ...category,
      active: true,
      sort_order: index + 1,
      created_at: new Date(),
    })),
  );
  return db('categories');
};

const insertUser = async (row) => {
  const [{ id }] = await db('users').insert(row).returning('id');
  const userId = typeof id === 'object' ? id.id : id;
  await db('notification_preferences')
    .insert({
      user_id: userId,
      complaint_notifications: true,
      assignment_notifications: true,
      resolution_notifications: true,
      email_notifications: chance(0.3),
      sms_notifications: chance(0.5),
    })
    .onConflict('user_id')
    .ignore();
  return userId;
};

export const seed = async ({ fresh = false } = {}) => {
  if (fresh) {
    logger.info('clearing existing data (fresh seed)');
    await truncateAll();
  }

  const existingUsers = await db('users').count({ c: 'id' }).first();
  if (Number(existingUsers?.c ?? 0) > 0 && !fresh) {
    logger.warn('database already contains users - seed skipped. Use `npm run db:reset` to rebuild.');
    return { skipped: true };
  }

  // ── Wards & categories ──────────────────────────────────────────────────
  let wards = await db('wards').select('*');
  if (!wards.length) wards = await seedWards();

  let categories = await db('categories').select('*');
  if (!categories.length) categories = await seedCategories();
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  // ── Settings ────────────────────────────────────────────────────────────
  await db('settings')
    .insert(DEFAULT_SETTINGS.map((s) => ({ ...s, updated_at: new Date() })))
    .onConflict('key')
    .ignore();

  // ── Users ───────────────────────────────────────────────────────────────
  const adminPasswordHash = await hashPassword(ADMIN_PASSWORD);
  const officerPasswordHash = await hashPassword(OFFICER_PASSWORD);
  const citizenPasswordHash = await hashPassword(CITIZEN_PASSWORD);

  const adminIds = [];
  for (const [index, [name, email, mobile, ration, designation]] of ADMINS.entries()) {
    adminIds.push(
      await insertUser({
        name,
        email,
        mobile,
        password_hash: adminPasswordHash,
        ration_number: ration,
        role: ROLES.ADMIN,
        ward_id: wards[0].id,
        designation,
        status: 'active',
        address: `${TENANT} Village Panchayat Office`,
        created_at: dateNDaysAgo(420 - index * 5),
        updated_at: dateNDaysAgo(30),
      }),
    );
  }

  const officerIds = [];
  for (const [index, [name, email, mobile, ration, wardCode, designation]] of OFFICERS.entries()) {
    const ward = wards.find((w) => w.code === `W0${wardCode}`) || wards[index % wards.length];
    officerIds.push({
      id: await insertUser({
        name,
        email,
        mobile,
        password_hash: officerPasswordHash,
        ration_number: ration,
        role: ROLES.OFFICER,
        ward_id: ward.id,
        designation,
        status: index === OFFICERS.length - 1 && chance(0.0) ? 'inactive' : 'active',
        address: `${ward.name}, ${TENANT}`,
        created_at: dateNDaysAgo(360 - index * 7),
        updated_at: dateNDaysAgo(20),
      }),
      wardId: ward.id,
      name,
    });
  }

  const citizenIds = [];
  for (const [index, [name, ration, mobile, email, wardCode]] of CITIZENS.entries()) {
    const ward = wards.find((w) => w.code === `W0${wardCode}`) || wards[0];
    citizenIds.push({
      id: await insertUser({
        name,
        email,
        mobile,
        password_hash: citizenPasswordHash,
        ration_number: ration,
        role: ROLES.CITIZEN,
        ward_id: ward.id,
        address: `${ward.name}, ${TENANT}`,
        status: index === CITIZENS.length - 1 && chance(0.0) ? 'inactive' : 'active',
        last_login_at: dateNDaysAgo(intBetween(1, 25)),
        created_at: dateNDaysAgo(400 - index * 11),
        updated_at: dateNDaysAgo(10),
      }),
      wardId: ward.id,
    });
  }

  // ── Complaints (≈18 months of history) ──────────────────────────────────
  const TOTAL_COMPLAINTS = 168;
  const counters = new Map();
  const historyRows = [];
  const assignmentRows = [];
  const notificationRows = [];
  const complaintRows = [];

  const statusPlan = () => {
    const roll = random();
    if (roll < 0.46) return STATUS.RESOLVED;
    if (roll < 0.7) return STATUS.PENDING;
    if (roll < 0.92) return STATUS.IN_PROGRESS;
    return STATUS.REJECTED;
  };

  for (let index = 0; index < TOTAL_COMPLAINTS; index += 1) {
    // Older complaints are far more likely to be closed already.
    const daysAgo = Math.round(540 * Math.pow(random(), 1.45)) + 1;
    const complaintDate = dateNDaysAgo(daysAgo, intBetween(8, 19));
    let status = statusPlan();
    if (daysAgo < 12 && status === STATUS.RESOLVED) status = chance(0.5) ? STATUS.IN_PROGRESS : STATUS.PENDING;

    const citizen = citizenIds[intBetween(0, citizenIds.length - 1)];
    const [slug, template] = DESCRIPTIONS[intBetween(0, DESCRIPTIONS.length - 1)];
    const category = categoryBySlug.get(slug) || categories[0];
    const [streetName, location] = STREETS[intBetween(0, STREETS.length - 1)];
    const ward = wards.find((w) => w.id === citizen.wardId) || wards[0];
    const description = template
      .replace('{street}', streetName)
      .replace('{days}', String(intBetween(3, 15)));
    const priority = pick([PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.MEDIUM, PRIORITY.HIGH, PRIORITY.HIGH, PRIORITY.CRITICAL]);

    const year = complaintDate.getUTCFullYear();
    const nextNumber = (counters.get(year) ?? 0) + 1;
    counters.set(year, nextNumber);
    const complaintId = `${config.branding.complaintIdPrefix}-${year}-${String(nextNumber).padStart(6, '0')}`;

    const officer = status === STATUS.PENDING && chance(0.55) ? null : officerIds[intBetween(0, officerIds.length - 1)];
    const approvedAt = status === STATUS.PENDING && chance(0.6) ? null : new Date(complaintDate.getTime() + intBetween(4, 40) * 3600000);
    const resolutionDate = status === STATUS.RESOLVED ? new Date(complaintDate.getTime() + intBetween(1, 22) * 86400000) : null;

    const remarks = status === STATUS.RESOLVED ? REMARKS[intBetween(0, 4)] : chance(0.5) ? REMARKS[intBetween(0, REMARKS.length - 1)] : null;

    const row = {
      complaint_id: complaintId,
      citizen_id: citizen.id,
      category_id: category.id,
      ward_id: ward.id,
      citizen_name: '', // filled with the citizen snapshot below
      ration_number: null,
      mobile_number: null,
      description,
      street_name: streetName,
      area: ward.name.replace(/ — .*/, ''),
      location,
      latitude: null,
      longitude: null,
      image_url: null,
      priority,
      status,
      assigned_officer_id: status === STATUS.REJECTED && chance(0.5) ? null : officer?.id ?? null,
      approved_by: approvedAt ? adminIds[intBetween(0, adminIds.length - 1)] : null,
      approved_at: approvedAt,
      resolved_by: status === STATUS.RESOLVED ? officer?.id ?? null : null,
      rejected_by: status === STATUS.REJECTED ? adminIds[0] : null,
      rejection_reason: status === STATUS.REJECTED ? REJECTION_REASONS[intBetween(0, REJECTION_REASONS.length - 1)] : null,
      complaint_date: complaintDate,
      resolution_date: resolutionDate,
      remarks,
      resolution_remarks: status === STATUS.RESOLVED ? RESOLUTION_REMARKS[intBetween(0, RESOLUTION_REMARKS.length - 1)] : null,
      created_at: complaintDate,
      updated_at: resolutionDate ?? complaintDate,
    };

    // Citizen details snapshot (denormalised by design - see database design notes).
    const citizenRow = await db('users').where({ id: citizen.id }).first('name', 'ration_number', 'mobile');
    row.citizen_name = citizenRow.name;
    row.ration_number = citizenRow.ration_number;
    row.mobile_number = citizenRow.mobile;

    complaintRows.push(row);
    complaintRows[complaintRows.length - 1].__meta = {
      officerId: row.assigned_officer_id,
      approvedAt,
      resolutionDate,
      complaintDate,
      status,
      citizenId: citizen.id,
      complaintId,
      adminId: row.approved_by,
    };
  }

  // Insert complaints in batches, capturing generated ids.
  const meta = [];
  for (let i = 0; i < complaintRows.length; i += 40) {
    const batch = complaintRows.slice(i, i + 40);
    const cleaned = batch.map(({ __meta, ...rest }) => rest);
    const ids = await db('complaints').insert(cleaned).returning('id');
    ids.forEach((entry) => meta.push(typeof entry === 'object' ? entry.id : entry));
  }
  complaintRows.forEach((row, index) => {
    row.__meta.dbId = meta[index];
  });

  // ── Counters, history, assignments, notifications ───────────────────────
  for (const row of complaintRows) {
    const m = row.__meta;
    const dbId = m.dbId;

    historyRows.push({
      complaint_id: dbId,
      old_status: null,
      new_status: STATUS.PENDING,
      action: 'created',
      changed_by: m.citizenId,
      changed_by_role: ROLES.CITIZEN,
      remarks: 'Complaint registered by the citizen through the portal.',
      timestamp: m.complaintDate,
    });

    if (m.approvedAt) {
      historyRows.push({
        complaint_id: dbId,
        old_status: STATUS.PENDING,
        new_status: STATUS.IN_PROGRESS,
        action: 'approved',
        changed_by: m.adminId ?? adminIds[0],
        changed_by_role: ROLES.ADMIN,
        remarks: 'Complaint verified and approved by the village administration.',
        timestamp: m.approvedAt,
      });
    }

    if (m.officerId) {
      const assignedAt = new Date((m.approvedAt ?? m.complaintDate).getTime() + intBetween(2, 20) * 3600000);
      assignmentRows.push({
        complaint_id: dbId,
        officer_id: m.officerId,
        assigned_by: m.adminId ?? adminIds[0],
        assigned_at: assignedAt,
        notes: 'Assigned during the daily grievance review meeting.',
        active: row.status !== STATUS.RESOLVED && row.status !== STATUS.REJECTED ? true : false,
      });
      historyRows.push({
        complaint_id: dbId,
        old_status: m.approvedAt ? STATUS.IN_PROGRESS : STATUS.PENDING,
        new_status: STATUS.IN_PROGRESS,
        action: 'assigned',
        changed_by: m.adminId ?? adminIds[0],
        changed_by_role: ROLES.ADMIN,
        remarks: `Complaint assigned to the ward officer for field verification.`,
        timestamp: assignedAt,
      });

      notificationRows.push({
        user_id: m.officerId,
        complaint_id: dbId,
        complaint_ref: m.complaintId,
        type: 'complaint_assigned',
        title: 'New complaint assigned to you',
        message: `Complaint ${m.complaintId} (${row.priority} priority) has been assigned to you. Location: ${row.location}.`,
        severity: row.priority === 'critical' ? 'warning' : 'info',
        link: `/complaints/${dbId}`,
        is_read: chance(0.6),
        created_at: assignedAt,
      });
    }

    if (row.remarks && m.officerId) {
      historyRows.push({
        complaint_id: dbId,
        old_status: row.status === STATUS.RESOLVED ? STATUS.IN_PROGRESS : row.status,
        new_status: row.status === STATUS.RESOLVED ? STATUS.IN_PROGRESS : row.status,
        action: 'remark',
        changed_by: m.officerId,
        changed_by_role: ROLES.OFFICER,
        remarks: row.remarks,
        timestamp: new Date((m.approvedAt ?? m.complaintDate).getTime() + intBetween(1, 5) * 86400000),
      });
    }

    if (m.resolutionDate) {
      historyRows.push({
        complaint_id: dbId,
        old_status: STATUS.IN_PROGRESS,
        new_status: STATUS.RESOLVED,
        action: 'status:resolved',
        changed_by: m.officerId ?? adminIds[0],
        changed_by_role: m.officerId ? ROLES.OFFICER : ROLES.ADMIN,
        remarks: row.resolution_remarks,
        timestamp: m.resolutionDate,
      });
    }

    if (row.status === STATUS.REJECTED) {
      const rejectedAt = new Date(m.complaintDate.getTime() + intBetween(1, 6) * 86400000);
      historyRows.push({
        complaint_id: dbId,
        old_status: STATUS.PENDING,
        new_status: STATUS.REJECTED,
        action: 'status:rejected',
        changed_by: adminIds[0],
        changed_by_role: ROLES.ADMIN,
        remarks: row.rejection_reason,
        timestamp: rejectedAt,
      });
      notificationRows.push({
        user_id: m.citizenId,
        complaint_id: dbId,
        complaint_ref: m.complaintId,
        type: 'complaint_rejected',
        title: 'Complaint rejected',
        message: `Complaint ${m.complaintId} has been rejected. Open the complaint to read the reason provided.`,
        severity: 'error',
        link: `/track?complaintId=${m.complaintId}`,
        is_read: chance(0.7),
        created_at: rejectedAt,
      });
    }

    if (m.resolutionDate) {
      notificationRows.push({
        user_id: m.citizenId,
        complaint_id: dbId,
        complaint_ref: m.complaintId,
        type: 'complaint_resolved',
        title: 'Complaint resolved',
        message: `Complaint ${m.complaintId} has been resolved. Please review the resolution details.`,
        severity: 'success',
        link: `/track?complaintId=${m.complaintId}`,
        is_read: chance(0.55),
        created_at: m.resolutionDate,
      });
    }

    notificationRows.push({
      user_id: m.citizenId,
      complaint_id: dbId,
      complaint_ref: m.complaintId,
      type: 'complaint_registered',
      title: 'Complaint registered successfully',
      message: `Your complaint ${m.complaintId} has been registered and is currently Pending. You can track it any time using this reference number.`,
      severity: 'success',
      link: `/track?complaintId=${m.complaintId}`,
      is_read: chance(0.65),
      created_at: m.complaintDate,
    });

    if (chance(0.35)) {
      notificationRows.push({
        user_id: adminIds[intBetween(0, adminIds.length - 1)],
        complaint_id: dbId,
        complaint_ref: m.complaintId,
        type: 'complaint_registered',
        title: 'New complaint registered',
        message: `New complaint ${m.complaintId} has been registered and is awaiting review.`,
        severity: 'info',
        link: `/complaints/${dbId}`,
        is_read: chance(0.7),
        created_at: m.complaintDate,
      });
    }
  }

  const batchInsert = async (table, rows, size = 60) => {
    for (let i = 0; i < rows.length; i += size) {
      await db(table).insert(rows.slice(i, i + size));
    }
  };

  await batchInsert('complaint_history', historyRows);
  await batchInsert('officer_assignments', assignmentRows);
  await batchInsert('notifications', notificationRows);

  // Counters must continue from the highest seeded number per year.
  for (const [year, lastNumber] of counters.entries()) {
    await db('complaint_counters')
      .insert({ year, last_number: lastNumber, updated_at: new Date() })
      .onConflict('year')
      .merge({ last_number: lastNumber, updated_at: new Date() });
  }

  await db('audit_logs').insert([
    {
      user_id: adminIds[0],
      action: 'system.seed',
      entity: 'system',
      entity_id: null,
      meta: JSON.stringify({ complaints: complaintRows.length }),
      created_at: new Date(),
    },
  ]);

  const summary = {
    wards: wards.length,
    categories: categories.length,
    users: adminIds.length + officerIds.length + citizenIds.length,
    admins: adminIds.length,
    officers: officerIds.length,
    citizens: citizenIds.length,
    complaints: complaintRows.length,
    historyEvents: historyRows.length,
    assignments: assignmentRows.length,
    notifications: notificationRows.length,
  };

  return summary;
};

const printSummary = (summary) => {
  if (summary?.skipped) return;
  /* eslint-disable no-console */
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│  VCMS seed data ready                                        │');
  console.log('└──────────────────────────────────────────────────────────────┘');
  console.log(`  Wards           : ${summary.wards}`);
  console.log(`  Categories      : ${summary.categories}`);
  console.log(`  Users           : ${summary.users}  (${summary.admins} admins, ${summary.officers} officers, ${summary.citizens} citizens)`);
  console.log(`  Complaints      : ${summary.complaints}`);
  console.log(`  History events  : ${summary.historyEvents}`);
  console.log(`  Assignments     : ${summary.assignments}`);
  console.log(`  Notifications   : ${summary.notifications}`);
  console.log('\n  Development-only sign-in credentials');
  console.log('  ──────────────────────────────────────────────');
  console.log(`  Administrator   : admin@vcms.gov.in        / ${ADMIN_PASSWORD}`);
  console.log(`  Administrator   : supervisor@vcms.gov.in   / ${ADMIN_PASSWORD}`);
  console.log(`  Village Officer : raj.kumar@vcms.gov.in    / ${OFFICER_PASSWORD}`);
  console.log(`  Village Officer : priya.anandan@vcms.gov.in/ ${OFFICER_PASSWORD}`);
  console.log(`  Citizen         : arun.kumar@example.com   / ${CITIZEN_PASSWORD}`);
  console.log(`  Citizen (mobile login): 9845012345         / ${CITIZEN_PASSWORD}`);
  console.log('\n  ⚠  These are development credentials. Never reuse them in production.\n');
};

const run = async () => {
  const fresh = process.argv.includes('--fresh') || process.env.SEED_FRESH === 'true';
  try {
    if (fresh) {
      // Rebuild the schema so the seed always matches the migrations.
      const { default: knexConfig } = await import('../../knexfile.js');
      const knex = (await import('knex')).default;
      const instance = knex(knexConfig[config.env] ?? knexConfig.development);
      await instance.migrate.rollback(undefined, true).catch(() => {});
      await instance.migrate.latest();
      await instance.destroy();
      logger.info('schema rebuilt from migrations');
    }

    const summary = await seed({ fresh });
    const { ensureDefaults } = await import('../services/settingsService.js');
    await ensureDefaults();
    printSummary(summary);
  } catch (error) {
    logger.error(`seed failed: ${error.message}`, error.stack);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
};

const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isDirectRun) run();

export default { seed };
