const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const bcrypt = require('bcryptjs');
const env = require('../../config/env.config');
const { pool } = require('../../config/db.config');
const { getMoodSubjectId } = require('../../modules/mood/moodIdentity');

const DEMO_PASSWORD = 'PeerBridgeDemo!2026';
const TRUST_SCORES = {
  student: 78,
  student2: 88,
  helperMath: 72,
  helperCs: 82,
  helperWellbeing: 65,
  helperGeneral: 61,
};
const DEMO_USERS = [
  {
    key: 'student',
    email: 'demo.student@peerbridge.test',
    role: 'student',
    name: 'Ayesha Student',
    anonymousId: 'CalmOwl#4101',
    department: 'Computer Science',
    semester: 4,
    subjects: ['Data Structures', 'Database Systems'],
    skills: ['Note taking', 'Study planning'],
    consentMood: true,
  },
  {
    key: 'student2',
    email: 'demo.student2@peerbridge.test',
    role: 'student',
    name: 'Hamza Student',
    anonymousId: 'BraveFox#4102',
    department: 'Computer Science',
    semester: 3,
    subjects: ['Programming Fundamentals', 'Discrete Mathematics'],
    skills: ['Peer mentoring'],
    consentMood: true,
  },
  {
    key: 'helperMath',
    email: 'demo.helper.math@peerbridge.test',
    role: 'student',
    name: 'Noor Helper',
    anonymousId: 'WiseFalcon#4103',
    department: 'Computer Science',
    semester: 5,
    subjects: ['Data Structures', 'Discrete Mathematics', 'Calculus'],
    skills: ['Mathematics', 'Problem solving'],
    consentMood: true,
  },
  {
    key: 'helperCs',
    email: 'demo.helper.cs@peerbridge.test',
    role: 'student',
    name: 'Zain Helper',
    anonymousId: 'SwiftHawk#4104',
    department: 'Computer Science',
    semester: 6,
    subjects: ['Database Systems', 'Programming Fundamentals', 'Data Structures'],
    skills: ['SQL', 'Programming'],
    consentMood: true,
  },
  {
    key: 'helperWellbeing',
    email: 'demo.helper.wellbeing@peerbridge.test',
    role: 'student',
    name: 'Mina Helper',
    anonymousId: 'GentleBear#4105',
    department: 'Psychology',
    semester: 5,
    subjects: ['Study Skills', 'Stress Management'],
    skills: ['Active listening', 'Study planning'],
    consentMood: true,
  },
  {
    key: 'helperGeneral',
    email: 'demo.helper.general@peerbridge.test',
    role: 'student',
    name: 'Ali Helper',
    anonymousId: 'BrightStag#4106',
    department: 'Electrical Engineering',
    semester: 7,
    subjects: ['Calculus', 'Physics', 'Programming Fundamentals'],
    skills: ['Physics', 'Peer mentoring'],
    consentMood: true,
  },
  {
    key: 'faculty',
    email: 'demo.faculty@peerbridge.test',
    role: 'faculty',
    name: 'Dr. Sara Faculty',
    anonymousId: 'FacultyPeer#4107',
    department: 'Computer Science',
    semester: null,
    subjects: ['Database Systems', 'Data Structures'],
    skills: ['Academic advising'],
    consentMood: false,
  },
  {
    key: 'admin',
    email: 'demo.admin@peerbridge.test',
    role: 'admin',
    name: 'Demo Administrator',
    anonymousId: 'AdminPeer#4108',
    department: 'Student Affairs',
    semester: null,
    subjects: [],
    skills: ['Moderation'],
    consentMood: false,
  },
  {
    key: 'superAdmin',
    email: 'demo.superadmin@peerbridge.test',
    role: 'super_admin',
    name: 'Demo Super Administrator',
    anonymousId: 'RootPeer#4109',
    department: 'Student Affairs',
    semester: null,
    subjects: [],
    skills: ['System administration'],
    consentMood: false,
  },
];

function ago(days, hours = 0) {
  return new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

function dateAgo(days) {
  return ago(days).slice(0, 10);
}

function writeLine(stream, message) {
  stream.write(`${message}\n`);
}

async function insertRows(connection, table, columns, rows) {
  if (rows.length === 0) return [];
  const columnSql = columns.map((column) => `\`${column}\``).join(', ');
  const rowSql = `(${columns.map(() => '?').join(', ')})`;
  const valuesSql = rows.map(() => rowSql).join(', ');
  const values = rows.flatMap((row) => row);
  const [result] = await connection.execute(
    `INSERT INTO \`${table}\` (${columnSql}) VALUES ${valuesSql}`,
    values
  );
  return rows.map((_, index) => result.insertId + index);
}

async function seedDemoData() {
  if (env.nodeEnv !== 'development') {
    throw new Error('Demo seeding is only allowed when NODE_ENV=development.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(env.db.host)) {
    throw new Error('Demo seeding only supports a local MySQL host.');
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    const emails = DEMO_USERS.map((user) => user.email);
    const [existingUsers] = await connection.query(
      `SELECT email FROM users WHERE email IN (${emails.map(() => '?').join(', ')})`,
      emails
    );
    if (existingUsers.length > 0) {
      if (existingUsers.length === DEMO_USERS.length) {
        writeLine(process.stdout, 'Demo accounts already exist; no sample data was added.');
        return;
      }
      throw new Error(
        'Some demo accounts already exist. No changes were made; remove the partial demo accounts before retrying.'
      );
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const userIds = {};
    for (const user of DEMO_USERS) {
      const [result] = await connection.execute(
        'INSERT INTO users (email, password_hash, role, is_first_login, behavior_score) VALUES (?, ?, ?, 0, 50)',
        [user.email, passwordHash, user.role]
      );
      userIds[user.key] = result.insertId;
    }

    const profiles = DEMO_USERS.map((user) => [
      userIds[user.key],
      user.anonymousId,
      user.department,
      user.role === 'faculty' ? 'Lecturer' : null,
      JSON.stringify(user.subjects),
      JSON.stringify(['Monday 14:00-16:00', 'Wednesday 12:00-14:00']),
      JSON.stringify(user.skills),
      50,
      user.consentMood ? 1 : 0,
      user.semester,
      user.name,
      user.consentMood ? 1 : 0,
      1,
      1,
      ago(1),
      TRUST_SCORES[user.key] || 50,
      0,
      null,
      1,
      1,
      `Demo profile for ${user.name}. This account contains fictional sample data.`,
    ]);
    await insertRows(
      connection,
      'profiles',
      [
        'user_id',
        'anonymous_id',
        'department',
        'designation',
        'subjects',
        'office_hours',
        'skills',
        'behavior_score',
        'consent_mood_tracking',
        'semester',
        'name',
        'consent_mood_data',
        'consent_analytics',
        'onboarding_complete',
        'last_active',
        'trust_score',
        'is_first_login',
        'profile_photo_url',
        'consent_data_collection',
        'consent_ai_analysis',
        'bio',
      ],
      profiles
    );
    await insertRows(
      connection,
      'anonymous_id_map',
      ['user_id', 'anonymous_id'],
      DEMO_USERS.map((user) => [userIds[user.key], user.anonymousId])
    );

    const helperUsers = ['helperMath', 'helperCs', 'helperWellbeing', 'helperGeneral'];
    const helperSubjects = {
      helperMath: ['Data Structures', 'Discrete Mathematics', 'Calculus'],
      helperCs: ['Database Systems', 'Programming Fundamentals', 'Data Structures'],
      helperWellbeing: ['Study Skills', 'Stress Management'],
      helperGeneral: ['Calculus', 'Physics', 'Programming Fundamentals'],
    };
    await insertRows(
      connection,
      'helper_listings',
      [
        'user_id',
        'anonymous_id',
        'subjects',
        'availability',
        'max_concurrent_help',
        'current_help_count',
        'total_helped',
      ],
      helperUsers.map((key, index) => [
        userIds[key],
        DEMO_USERS.find((user) => user.key === key).anonymousId,
        JSON.stringify(helperSubjects[key]),
        index === 3 ? 'busy' : 'available',
        3,
        index === 0 ? 1 : 0,
        [8, 12, 5, 3][index],
      ])
    );

    const requestIds = await insertRows(
      connection,
      'academic_requests',
      [
        'user_id',
        'anonymous_id',
        'subject',
        'urgency',
        'title',
        'description',
        'status',
        'matched_helper_id',
        'matched_at',
        'resolved_at',
        'appeal_status',
        'ai_moderation_status',
        'daily_post_count',
        'created_at',
      ],
      [
        [
          userIds.student,
          'CalmOwl#4101',
          'Data Structures',
          'high',
          'Need help understanding binary search trees',
          'I understand arrays but need a step-by-step explanation of tree insertion and traversal.',
          'open',
          null,
          null,
          null,
          'none',
          'clean',
          1,
          ago(0, 3),
        ],
        [
          userIds.student,
          'CalmOwl#4101',
          'Database Systems',
          'medium',
          'Reviewing database normalization',
          'Looking for a peer to review 2NF and 3NF examples before the next quiz.',
          'in_progress',
          userIds.helperCs,
          ago(2),
          null,
          'none',
          'clean',
          1,
          ago(4),
        ],
        [
          userIds.student2,
          'BraveFox#4102',
          'Discrete Mathematics',
          'low',
          'Practice with proof techniques',
          'Would appreciate a few examples of induction and contradiction proofs.',
          'resolved',
          userIds.helperMath,
          ago(10),
          ago(8),
          'none',
          'clean',
          1,
          ago(12),
        ],
        [
          userIds.student2,
          'BraveFox#4102',
          'Study Skills',
          'medium',
          'Planning a balanced study schedule',
          'Seeking practical tips for planning coursework and taking regular breaks.',
          'open',
          null,
          null,
          null,
          'none',
          'clean',
          2,
          ago(1),
        ],
      ]
    );

    const chatRequestIds = await insertRows(
      connection,
      'chat_requests',
      [
        'sender_id',
        'receiver_id',
        'status',
        'expires_at',
        'created_at',
        'subject_context',
        'academic_request_id',
      ],
      [
        [
          userIds.student,
          userIds.helperCs,
          'accepted',
          ago(-2),
          ago(4),
          'Database Systems - normalization',
          requestIds[1],
        ],
        [
          userIds.student,
          userIds.helperMath,
          'pending',
          ago(-1),
          ago(0, 2),
          'Data Structures - binary search trees',
          requestIds[0],
        ],
        [
          userIds.student2,
          userIds.helperMath,
          'accepted',
          ago(-2),
          ago(11),
          'Discrete Mathematics - proof techniques',
          requestIds[2],
        ],
        [
          userIds.student2,
          userIds.helperGeneral,
          'declined',
          ago(-1),
          ago(5),
          'Calculus study session',
          null,
        ],
      ]
    );
    await insertRows(
      connection,
      'chat_messages',
      [
        'sender_id',
        'receiver_id',
        'message',
        'is_flagged',
        'created_at',
        'chat_mode',
        'seen_at',
        'expires_at',
        'is_deleted',
        'delivered_at',
        'is_broadcast',
      ],
      [
        [
          userIds.student,
          userIds.helperCs,
          'Hi, could we go over the normalization example together?',
          0,
          ago(3),
          'chat_only',
          ago(3),
          ago(-2),
          0,
          ago(3),
          0,
        ],
        [
          userIds.helperCs,
          userIds.student,
          'Of course. Lets start by identifying the candidate keys.',
          0,
          ago(3, 1),
          'chat_only',
          ago(3),
          ago(-2),
          0,
          ago(3, 1),
          0,
        ],
        [
          userIds.student,
          userIds.helperCs,
          'That makes sense. I will try the next example now.',
          0,
          ago(2, 23),
          'chat_only',
          null,
          ago(-2),
          0,
          ago(2, 23),
          0,
        ],
        [
          userIds.student2,
          userIds.helperMath,
          'Thanks for the proof practice session!',
          0,
          ago(8),
          'study_group',
          ago(8),
          ago(-1),
          0,
          ago(8),
          0,
        ],
      ]
    );
    await insertRows(
      connection,
      'conversations',
      ['participant_one', 'participant_two', 'chat_mode', 'is_active', 'created_at'],
      [
        [userIds.student, userIds.helperCs, 'CHAT_ONLY', 1, ago(4)],
        [userIds.student2, userIds.helperMath, 'STUDY_GROUP', 1, ago(11)],
      ]
    );
    await insertRows(
      connection,
      'chat_rooms',
      ['room_name', 'mode'],
      [
        ['Demo Data Structures Study Group', 'study_group'],
        ['Demo Campus Study Meetup', 'campus_meeting'],
      ]
    );
    await insertRows(
      connection,
      'helper_feedback',
      ['request_id', 'helper_user_id', 'requester_user_id', 'rating'],
      [[requestIds[2], userIds.helperMath, userIds.student2, 5]]
    );
    await insertRows(
      connection,
      'feedback',
      ['from_user', 'to_user', 'rating', 'comment', 'request_id', 'created_at'],
      [
        [
          userIds.student2,
          userIds.helperMath,
          5,
          'Clear explanations and a friendly pace.',
          chatRequestIds[2],
          ago(8),
        ],
      ]
    );
    await insertRows(
      connection,
      'peer_matches',
      [
        'requester_id',
        'matched_user_id',
        'subject',
        'match_score',
        'status',
        'response_deadline',
        'feedback_rating',
        'created_at',
      ],
      [
        [
          userIds.student,
          userIds.helperCs,
          'Database Systems',
          92.5,
          'ACCEPTED',
          ago(-2),
          5,
          ago(4),
        ],
        [
          userIds.student2,
          userIds.helperMath,
          'Discrete Mathematics',
          88,
          'ACCEPTED',
          ago(-1),
          5,
          ago(11),
        ],
        [
          userIds.student,
          userIds.helperMath,
          'Data Structures',
          81.5,
          'PENDING',
          ago(-1),
          null,
          ago(0, 2),
        ],
      ]
    );
    await insertRows(
      connection,
      'request_appeals',
      [
        'request_id',
        'user_id',
        'appeal_reason',
        'status',
        'reviewed_by',
        'reviewed_at',
        'created_at',
      ],
      [
        [
          requestIds[2],
          userIds.student2,
          'Demo appeal record for administrator review practice.',
          'approved',
          userIds.admin,
          ago(7),
          ago(9),
        ],
      ]
    );
    await insertRows(
      connection,
      'daily_post_tracker',
      ['user_id', 'post_date', 'post_count'],
      [
        [userIds.student, dateAgo(0), 2],
        [userIds.student2, dateAgo(0), 1],
      ]
    );

    const moodRows = [];
    for (const user of DEMO_USERS.filter((entry) => entry.consentMood)) {
      const scores =
        user.key === 'student' ? [3, 4, 3] : user.key === 'student2' ? [2, 3, 4] : [3, 4, 4];
      [2, 4, 6].forEach((daysAgo, index) => {
        moodRows.push([
          getMoodSubjectId(userIds[user.key]),
          user.department,
          scores[index],
          [
            'Balancing study and rest.',
            'Made progress on coursework.',
            'Checked in after a busy week.',
          ][index],
          scores[index] <= 2 ? 1 : 0,
          ago(daysAgo),
        ]);
      });
    }
    await insertRows(
      connection,
      'mood_entries',
      [
        'mood_subject_id',
        'department',
        'mood_score',
        'notes',
        'consecutive_low_count',
        'created_at',
      ],
      moodRows
    );

    const resourceIds = await insertRows(
      connection,
      'resources',
      [
        'uploader_id',
        'title',
        'description',
        'subject',
        'semester',
        'category',
        'external_url',
        'status',
        'is_flagged',
        'reviewed_by',
        'reviewed_at',
        'review_note',
        'relevance_score',
        'quality_score',
        'created_at',
      ],
      [
        [
          userIds.helperCs,
          'Database Normalization Quick Guide',
          'A fictional demo resource covering functional dependencies and first through third normal form.',
          'Database Systems',
          '4',
          'lecture notes',
          'https://example.com/peerbridge-demo/database-normalization',
          'approved',
          0,
          userIds.faculty,
          ago(5),
          'Approved demo resource.',
          5,
          5,
          ago(6),
        ],
        [
          userIds.helperMath,
          'Binary Tree Practice Problems',
          'Practice prompts for traversal, insertion, and tree-height reasoning.',
          'Data Structures',
          '4',
          'practice',
          'https://example.com/peerbridge-demo/binary-trees',
          'approved',
          0,
          userIds.faculty,
          ago(3),
          'Approved demo resource.',
          5,
          4,
          ago(4),
        ],
        [
          userIds.student2,
          'Study Break and Wellbeing Checklist',
          'A sample checklist with reflection prompts and practical ways to structure a study break.',
          null,
          '3',
          'wellbeing',
          'https://example.com/peerbridge-demo/wellbeing-checklist',
          'pending',
          0,
          null,
          null,
          null,
          null,
          null,
          ago(0, 5),
        ],
      ]
    );
    await insertRows(
      connection,
      'resource_reviews',
      ['resource_id', 'user_id', 'rating', 'review'],
      [
        [resourceIds[0], userIds.student, 5, 'Helpful overview for revision.'],
        [resourceIds[1], userIds.student2, 4, 'Good practice prompts.'],
      ]
    );
    await insertRows(
      connection,
      'resource_bookmarks',
      ['resource_id', 'user_id'],
      [
        [resourceIds[0], userIds.student],
        [resourceIds[1], userIds.student2],
      ]
    );

    const noticeIds = await insertRows(
      connection,
      'notice_posts',
      [
        'user_id',
        'department',
        'category',
        'title',
        'body',
        'location_name',
        'is_official',
        'status',
        'is_flagged',
        'severity',
        'reports_count',
        'views_count',
        'trending_score',
        'appeal_available',
        'expires_at',
        'reviewed_by',
        'reviewed_at',
        'created_at',
      ],
      [
        [
          userIds.student,
          'Computer Science',
          'study_groups',
          'Data Structures Study Circle',
          'A friendly demo study group for reviewing trees and graphs. All experience levels welcome.',
          'Library, Room 2',
          0,
          'published',
          0,
          'LOW',
          0,
          26,
          7.5,
          0,
          ago(-14),
          null,
          null,
          ago(1),
        ],
        [
          userIds.faculty,
          'Computer Science',
          'announcements',
          'Peer Support Orientation',
          'Demo announcement: learn how anonymous peer support and respectful communication work.',
          'Student Centre',
          1,
          'published',
          0,
          'LOW',
          0,
          42,
          10,
          0,
          ago(-21),
          userIds.admin,
          ago(2),
          ago(2),
        ],
        [
          userIds.student2,
          'Computer Science',
          'events',
          'Quiet Study Hour',
          'A demo event for focused study with a short wellbeing break.',
          'North Campus Library',
          0,
          'held',
          1,
          'MEDIUM',
          1,
          4,
          0,
          1,
          ago(-7),
          userIds.admin,
          ago(0, 8),
          ago(0, 10),
        ],
      ]
    );
    await insertRows(
      connection,
      'notice_reactions',
      ['post_id', 'user_id', 'reaction'],
      [
        [noticeIds[0], userIds.student2, 'interested'],
        [noticeIds[0], userIds.helperMath, 'like'],
        [noticeIds[1], userIds.student, 'like'],
      ]
    );
    await insertRows(
      connection,
      'notice_saves',
      ['post_id', 'user_id'],
      [
        [noticeIds[0], userIds.student2],
        [noticeIds[1], userIds.helperCs],
      ]
    );
    await insertRows(
      connection,
      'notice_post_reports',
      ['post_id', 'reporter_id', 'reason'],
      [[noticeIds[2], userIds.student, 'Demo report for testing the notice review workflow.']]
    );
    await insertRows(
      connection,
      'notice_appeals',
      ['post_id', 'user_id', 'reason', 'status'],
      [[noticeIds[2], userIds.student2, 'Demo appeal requesting a second review.', 'pending']]
    );

    const reportIds = await insertRows(
      connection,
      'reports',
      [
        'reporter_id',
        'reported_id',
        'reason',
        'category',
        'status',
        'level',
        'priority',
        'is_flagged',
        'assigned_to',
        'faculty_note',
        'resolved_at',
        'created_at',
      ],
      [
        [
          userIds.student,
          userIds.student2,
          'Demo case for practicing a respectful, privacy-conscious review.',
          'privacy_violation',
          'under_review',
          1,
          'normal',
          1,
          userIds.admin,
          null,
          null,
          ago(1),
        ],
        [
          userIds.student2,
          userIds.helperGeneral,
          'Demo resolved case showing the complaint history workflow.',
          'other',
          'resolved',
          1,
          'normal',
          0,
          userIds.faculty,
          'Reviewed as sample data; no real person or incident is involved.',
          ago(4),
          ago(5),
        ],
      ]
    );
    await insertRows(
      connection,
      'complaint_history',
      ['complaint_id', 'actor_id', 'action', 'details', 'created_at'],
      [
        [
          reportIds[0],
          userIds.admin,
          'assigned',
          JSON.stringify({ note: 'Assigned to demo administrator.' }),
          ago(1),
        ],
        [
          reportIds[1],
          userIds.faculty,
          'resolved',
          JSON.stringify({ note: 'Closed fictional demo case.' }),
          ago(4),
        ],
      ]
    );
    await insertRows(
      connection,
      'moderation_queue',
      [
        'content_type',
        'content_id',
        'content_text',
        'user_id',
        'anonymous_id',
        'ai_severity',
        'ai_reason',
        'status',
        'reviewed_by',
        'reviewed_at',
        'created_at',
      ],
      [
        [
          'notice_post',
          noticeIds[2],
          'Demo held notice awaiting a moderation review.',
          userIds.student2,
          'BraveFox#4102',
          'MEDIUM',
          'Seeded sample to demonstrate the moderation queue.',
          'pending',
          null,
          null,
          ago(0, 10),
        ],
        [
          'academic_request',
          requestIds[0],
          'Sample academic support request approved for the demo feed.',
          userIds.student,
          'CalmOwl#4101',
          'LOW',
          'Seeded sample showing reviewed queue history.',
          'approved',
          userIds.faculty,
          ago(3),
          ago(3, 2),
        ],
      ]
    );
    await insertRows(
      connection,
      'escalation_records',
      [
        'user_id',
        'anonymous_id',
        'level',
        'reason',
        'content_ref',
        'actioned_by',
        'secondary_approval_by',
        'created_at',
      ],
      [
        [
          userIds.student2,
          'BraveFox#4102',
          'warning',
          'Fictional demo record illustrating a low-impact moderation workflow.',
          `notice:${noticeIds[2]}`,
          userIds.admin,
          null,
          ago(0, 10),
        ],
      ]
    );

    const trustTiers = ['silver', 'gold', 'bronze', 'silver', 'bronze', 'bronze'];
    const students = DEMO_USERS.filter((user) => user.role === 'student');
    const trustScores = students.map((user) => TRUST_SCORES[user.key]);
    await insertRows(
      connection,
      'trust_scores',
      [
        'user_id',
        'score',
        'helpfulness_rating',
        'resolution_count',
        'violation_count',
        'avg_response_time',
        'badge_tier',
        'last_calculated',
      ],
      students.map((user, index) => [
        userIds[user.key],
        trustScores[index],
        [4.5, 4.8, 4.9, 4.7, 4.6, 4.3][index],
        [2, 1, 8, 12, 5, 3][index],
        0,
        [30, 42, 25, 28, 38, 45][index],
        trustTiers[index].toUpperCase(),
        ago(0),
      ])
    );
    await insertRows(
      connection,
      'trust_score_components',
      [
        'user_id',
        'helpfulness_rating',
        'resolution_count',
        'violation_count',
        'avg_response_time_minutes',
        'total_ratings_received',
        'last_calculated',
        'event_adjustment',
      ],
      students.map((user, index) => [
        userIds[user.key],
        [4.5, 4.8, 4.9, 4.7, 4.6, 4.3][index],
        [2, 1, 8, 12, 5, 3][index],
        0,
        [30, 42, 25, 28, 38, 45][index],
        [2, 1, 7, 10, 4, 2][index],
        ago(0),
        0,
      ])
    );
    await insertRows(
      connection,
      'badge_tiers',
      ['user_id', 'current_tier', 'previous_tier', 'tier_achieved_at'],
      students.map((user, index) => [
        userIds[user.key],
        trustTiers[index],
        index === 1 ? 'silver' : null,
        ago([20, 3, 8, 5, 12, 18][index]),
      ])
    );
    await insertRows(
      connection,
      'trust_score_history',
      [
        'user_id',
        'admin_id',
        'old_score',
        'new_score',
        'change_amount',
        'change_reason',
        'change_type',
        'created_at',
      ],
      [
        [
          userIds.helperMath,
          userIds.admin,
          68,
          72,
          4,
          'Completed a demo peer-support request.',
          'increase',
          ago(8),
        ],
        [
          userIds.helperCs,
          userIds.admin,
          79,
          82,
          3,
          'Received positive demo feedback.',
          'increase',
          ago(5),
        ],
      ]
    );
    const currentMonth = new Date().toISOString().slice(0, 7);
    await insertRows(
      connection,
      'monthly_leaderboard',
      [
        'user_id',
        'anonymous_id',
        'department',
        'month_year',
        'help_count',
        'avg_rating',
        'trust_score',
        'rank_position',
      ],
      students
        .slice(0, 4)
        .map((user, index) => [
          userIds[user.key],
          user.anonymousId,
          user.department,
          currentMonth,
          [2, 1, 8, 12][index],
          [4.5, 4.8, 4.9, 4.7][index],
          trustScores[index],
          index + 1,
        ])
    );

    await insertRows(
      connection,
      'broadcasts',
      ['sender_id', 'department', 'message', 'sender_role', 'timestamp'],
      [
        [
          userIds.faculty,
          'Computer Science',
          'Demo broadcast: peer-support orientation and study-group sign-ups are open this week.',
          'faculty',
          ago(1),
        ],
      ]
    );
    await insertRows(
      connection,
      'notifications',
      ['user_id', 'type', 'message', 'is_read', 'created_at'],
      [
        [
          userIds.student,
          'chat_request',
          'A peer helper accepted your Database Systems chat request.',
          0,
          ago(0, 1),
        ],
        [
          userIds.student,
          'academic_match',
          'A helper is available for your Data Structures request.',
          0,
          ago(0, 2),
        ],
        [
          userIds.helperMath,
          'feedback',
          'You received positive feedback for a completed demo request.',
          1,
          ago(8),
        ],
        [
          userIds.faculty,
          'resource_review',
          'A sample wellbeing resource is waiting for review.',
          0,
          ago(0, 5),
        ],
      ]
    );
    await insertRows(
      connection,
      'audit_logs',
      ['user_id', 'action', 'details', 'target_type', 'target_id', 'severity', 'created_at'],
      [
        [
          userIds.admin,
          'DEMO_REVIEW_ASSIGNED',
          JSON.stringify({ source: 'demo-seed' }),
          'report',
          String(reportIds[0]),
          'LOW',
          ago(1),
        ],
        [
          userIds.faculty,
          'DEMO_RESOURCE_APPROVED',
          JSON.stringify({ source: 'demo-seed' }),
          'resource',
          String(resourceIds[0]),
          'LOW',
          ago(5),
        ],
      ]
    );
    await insertRows(
      connection,
      'policy_reviews',
      ['review_week', 'reviewer_id', 'summary', 'completed_at'],
      [
        [
          dateAgo(7),
          userIds.admin,
          'Demo policy review entry for the administration dashboard.',
          ago(2),
        ],
      ]
    );
    await insertRows(
      connection,
      'moderation_rules',
      ['term', 'severity', 'enabled', 'created_by', 'updated_by'],
      [
        ['demo_spam_phrase', 'MEDIUM', 1, userIds.admin, userIds.admin],
        ['demo_privacy_marker', 'HIGH', 1, userIds.admin, userIds.admin],
      ]
    );

    await connection.commit();
    transactionStarted = false;

    writeLine(process.stdout, 'PeerBridge demo data seeded successfully.');
    writeLine(
      process.stdout,
      `  Accounts: ${DEMO_USERS.length} (6 students/helpers, 1 faculty, 1 admin, 1 super admin)`
    );
    writeLine(
      process.stdout,
      '  Covered: profiles, anonymous IDs, academic support, matching, chat, mood history,'
    );
    writeLine(
      process.stdout,
      '           resources, notices, reports, moderation, trust/badges, notifications, and audit.'
    );
    writeLine(process.stdout, `  Login password for all demo accounts: ${DEMO_PASSWORD}`);
    writeLine(
      process.stdout,
      '  Account emails are listed in README.md; all records are fictional.'
    );
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  seedDemoData()
    .catch((error) => {
      writeLine(process.stderr, `Demo seeding failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

module.exports = { seedDemoData };
