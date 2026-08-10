import { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Skeleton, Box } from '@mui/material';
import {
  Group, School, AccountTree, Class as ClassIcon, CalendarMonth, Sensors,
} from '@mui/icons-material';
import { adminApi, Stats } from '../services/adminApi';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    adminApi.stats().then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);

  const cards = stats
    ? [
        { label: 'Teachers', value: stats.teachers, icon: <Group />, color: '#4cc9f0' },
        { label: 'Students', value: stats.students, icon: <School />, color: '#f72585' },
        { label: 'Divisions', value: stats.divisions, icon: <AccountTree />, color: '#4ade80' },
        { label: 'Courses', value: stats.courses, icon: <ClassIcon />, color: '#fbbf24' },
        { label: 'Timetable entries', value: stats.assignments, icon: <CalendarMonth />, color: '#a78bfa' },
        { label: 'Active sessions', value: stats.active_sessions, icon: <Sensors />, color: '#fb7185' },
      ]
    : [];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>College Overview</Typography>
      <Grid container spacing={3}>
        {cards.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}><Skeleton variant="rounded" height={120} /></Grid>
            ))
          : cards.map((c) => (
              <Grid item xs={12} sm={6} md={4} key={c.label}>
                <Card sx={{ borderLeft: `4px solid ${c.color}`, height: '100%' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ borderRadius: 2, p: 1.5, bgcolor: `${c.color}22`, color: c.color }}>{c.icon}</Box>
                    <Box>
                      <Typography variant="h4" fontWeight={800}>{c.value}</Typography>
                      <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
      </Grid>
    </Box>
  );
}
