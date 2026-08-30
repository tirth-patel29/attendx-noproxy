import { query } from '../utils/db';

export interface ParsedStudentId {
  isD2d: boolean;
  joiningYear: number;
  collegeCode: string; // e.g. 'D' for DEPSTAR, 'C' for CSPIT
  branchCode: string | null;
  rollSuffix: number;
}

export interface AcademicIdentity {
  college_id?: string;
  department_id?: string;
  branch_id?: string;
  division_id?: string;
  batch_id?: string;
  college_name?: string;
  branch_name?: string;
  division_name?: string;
  batch_name?: string;
}

export class AcademicResolverService {
  /**
   * Parses the enrollment number to extract structural components.
   * e.g., 24DCE071 -> 24 (Year), D (DEPSTAR), CE (Branch), 071
   * 24CE001 -> 24 (Year), C (CSPIT - implicit), CE (Branch), 001
   * D25D152 -> D2D, 25 (Year), D (DEPSTAR), 152
   */
  parseEnrollmentNumber(rollNo: string): ParsedStudentId | null {
    const regex = /^(D)?(\d{2})([A-Z])?([A-Z]{2,4})?(\d{3})$/i;
    const match = rollNo.toUpperCase().match(regex);
    if (!match) return null;

    const isD2d = !!match[1];
    const joiningYear = parseInt(match[2], 10) + 2000;
    
    // College Code: If there is a single letter before the branch, it's usually 'D' for DEPSTAR.
    // If not present, it's usually CSPIT ('C').
    // But wait, what if match[3] is the first letter of a 3-letter branch like "AIML" and match[4] is the rest?
    // Actually, "AIML" is 4 letters. If the regex matches 24DAIML001, match[3] = D, match[4] = AIML.
    // If 24CE001, match[3] = C (if we aren't careful) - wait, "CE" is 2 letters.
    // Let's refine based on the lengths.
    
    let collegeCode = 'C'; // Default to CSPIT if no specific college letter
    let branchCode = null;
    
    if (match[3] && match[4]) {
        // match[3] is the college code (e.g. 'D'), match[4] is branch ('CE')
        collegeCode = match[3];
        branchCode = match[4];
    } else if (match[3] && !match[4]) {
        // e.g. D25D152 -> match[3] is 'D', match[4] is undefined
        collegeCode = match[3];
    } else if (!match[3] && match[4]) {
        // e.g. 24CE001 -> match[3] is undefined, match[4] is 'CE'
        branchCode = match[4];
    }
    
    const rollSuffix = parseInt(match[5], 10);

    return {
      isD2d,
      joiningYear,
      collegeCode,
      branchCode,
      rollSuffix
    };
  }

  /**
   * Resolves a student's full academic hierarchy from their roll number.
   * Prioritizes finding a matching batch range. If no batch matches, attempts to resolve
   * downwards from College -> Branch -> Division based on the parsed string.
   */
  async resolveStudentIdentity(rollNo: string): Promise<AcademicIdentity> {
    const identity: AcademicIdentity = {};
    const parsed = this.parseEnrollmentNumber(rollNo);
    
    if (!parsed) {
      throw new Error(`Invalid roll number format: ${rollNo}`);
    }

    // 1. Try to find the exact Batch by roll number range
    // Since roll numbers are alphanumeric and zero-padded, we can do string comparisons.
    // However, length matters (e.g. '24DCE071' vs '24DCE100'). They are all 8 chars (or 7).
    const batchQuery = `
      SELECT 
        b.id AS batch_id, b.name AS batch_name,
        div.division_id, div.name AS division_name,
        br.id AS branch_id, br.name AS branch_name,
        dept.id AS department_id,
        c.id AS college_id, c.name AS college_name
      FROM batches b
      JOIN divisions div ON b.division_id = div.division_id
      JOIN branches br ON div.branch_id = br.id
      JOIN departments dept ON br.department_id = dept.id
      JOIN colleges c ON dept.college_id = c.id
      WHERE $1 >= b.start_roll AND $1 <= b.end_roll
        AND LENGTH($1) = LENGTH(b.start_roll) -- Ensure we don't match mismatched lengths
      LIMIT 1
    `;
    
    const batchRes = await query(batchQuery, [rollNo.toUpperCase()]);
    
    if (batchRes.rows.length > 0) {
      const row = batchRes.rows[0];
      return {
        college_id: row.college_id,
        department_id: row.department_id,
        branch_id: row.branch_id,
        division_id: row.division_id,
        batch_id: row.batch_id,
        college_name: row.college_name,
        branch_name: row.branch_name,
        division_name: row.division_name,
        batch_name: row.batch_name
      };
    }

    // 2. If no batch matched, resolve hierarchically based on parsed components
    let hierarchyQuery = `
      SELECT 
        c.id AS college_id, c.name AS college_name,
        dept.id AS department_id,
        br.id AS branch_id, br.name AS branch_name
      FROM colleges c
      JOIN departments dept ON dept.college_id = c.id
      JOIN branches br ON br.department_id = dept.id
      WHERE c.code = $1 
    `;
    const params: any[] = [parsed.collegeCode];
    
    if (parsed.branchCode) {
      hierarchyQuery += ` AND br.code = $2`;
      params.push(parsed.branchCode);
    }
    
    hierarchyQuery += ` LIMIT 1`;
    
    const hierarchyRes = await query(hierarchyQuery, params);
    
    if (hierarchyRes.rows.length > 0) {
      const row = hierarchyRes.rows[0];
      identity.college_id = row.college_id;
      identity.department_id = row.department_id;
      identity.branch_id = row.branch_id;
      identity.college_name = row.college_name;
      identity.branch_name = row.branch_name;
      
      // Try to find a division that matches the academic year
      // Current system year logic (as of 2026): 2024 = 3rd yr, 2025 = 2nd yr, 2026 = 1st yr
      const academicYear = 3 - (parsed.joiningYear - 2024);
      
      const divQuery = `
        SELECT division_id, name AS division_name 
        FROM divisions 
        WHERE branch_id = $1 AND academic_year = $2
        LIMIT 1
      `;
      const divRes = await query(divQuery, [row.branch_id, academicYear]);
      if (divRes.rows.length > 0) {
        identity.division_id = divRes.rows[0].division_id;
        identity.division_name = divRes.rows[0].division_name;
      }
    }

    return identity;
  }
}

export const academicResolver = new AcademicResolverService();
