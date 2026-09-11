import { query } from './src/utils/db.js';

async function test() {
  const r = await query(`
    SELECT 
      to_char(cs.session_date, 'Mon DD') as day,
      ROUND((COUNT(DISTINCT al.ledger_uuid)::float / NULLIF(SUM(
        (SELECT COUNT(*) FROM students s JOIN courses c ON c.division_id = s.division_id WHERE c.course_code = cs.course_code)
      ), 0) * 100)::numeric, 0)::int as rate
    FROM course_sessions cs
    LEFT JOIN attendance_ledger al ON al.session_uuid = cs.session_uuid AND al.status = 'PRESENT'
    WHERE cs.session_date >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY cs.session_date
    ORDER BY cs.session_date ASC;
  `);
  console.log('Attendance Trend:', r.rows);

  const r2 = await query(`
    SELECT status as name, COUNT(*)::int as value
    FROM attendance_ledger
    WHERE server_logged_time >= NOW() - INTERVAL '1 day'
    GROUP BY status
  `);
  console.log('Verification Split:', r2.rows);

  const r3 = await query(`
    SELECT 
      event_type, actor_uuid, payload, created_at, source_ip
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.log('Recent Activity:', r3.rows);
  
  const r4 = await query(`
    SELECT 
      d.name as department,
      COUNT(s.student_uuid)::int as students,
      COUNT(DISTINCT c.course_code)::int as courses
    FROM departments d
    LEFT JOIN branches b ON b.department_id = d.id
    LEFT JOIN divisions div ON div.branch_id = b.id
    LEFT JOIN students s ON s.division_id = div.division_id
    LEFT JOIN courses c ON c.division_id = div.division_id
    GROUP BY d.name
  `);
  console.log('Department Stats:', r4.rows);
  
  process.exit(0);
}

test().catch(console.error);
