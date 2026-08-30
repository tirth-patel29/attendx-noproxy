import fs from 'fs';
import path from 'path';
import { query } from '../src/utils/db';

async function run() {
  try {
    console.log('Running 008...');
    const sql8 = fs.readFileSync(path.join(__dirname, '../../migrations/008_phase3_academic_hierarchy.sql'), 'utf8');
    await query(sql8);
    console.log('Ran 008.');
    
    console.log('Running 009...');
    const sql9 = fs.readFileSync(path.join(__dirname, '../../migrations/009_seed_academic_hierarchy.sql'), 'utf8');
    try {
        await query(sql9);
        console.log('Ran 009.');
    } catch (e: any) {
        console.log('Seed err:', e.message);
    }
  } catch (err) {
    console.error('Error applying migrations:', err);
  } finally {
    process.exit(0);
  }
}

run();
