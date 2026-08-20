import { useEffect, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, LinearProgress, Typography, Tooltip,
} from '@mui/material';
import { Add as AddIcon, ContentCopy as CopyIcon, DeleteForever as RevokeIcon, Key as KeyIcon } from '@mui/icons-material';
import { adminApi, ApiKey } from '../services/adminApi';

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [mintOpen, setMintOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [mintBusy, setMintBusy] = useState(false);
  const [mintErr, setMintErr] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ label: string; api_key: string } | null>(null);

  const [flash, setFlash] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await adminApi.apiKeys();
      setKeys(res.data.keys ?? []);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copy = (t: string) => { navigator.clipboard?.writeText(t); setFlash('Copied to clipboard'); };

  const mint = async () => {
    if (!label.trim()) { setMintErr('Give this key a label (e.g. student-apk)'); return; }
    setMintBusy(true); setMintErr(null);
    try {
      const res = await adminApi.createApiKey(label.trim());
      setMintOpen(false);
      setLabel('');
      setNewKey({ label: res.data.label, api_key: res.data.api_key });
      load();
    } catch (e: any) {
      setMintErr(e?.response?.data?.error ?? 'Mint failed');
    } finally {
      setMintBusy(false);
    }
  };

  const revoke = async (k: ApiKey) => {
    if (!window.confirm(`Revoke key "${k.label}" (${k.prefix})? Client apps using it will be rejected immediately.`)) return;
    try {
      await adminApi.revokeApiKey(k.key_uuid);
      setFlash(`Revoked ${k.label}`);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Revoke failed');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>API Keys</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setMintOpen(true)}>
          Generate Key
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        These shared keys authenticate the <strong>client app</strong> (the student APK, sent as the{' '}
        <code>X-Api-Key</code> header). A key is shown only once at mint time — if lost, generate a new one and
        revoke the old. Revoking a key immediately rejects that client.
      </Alert>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {flash && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setFlash(null)}>{flash}</Alert>}

      {loading ? (
        <LinearProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Label</TableCell>
                <TableCell>Prefix</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {keys.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No API keys yet. Generate your first one.
                </TableCell></TableRow>
              )}
              {keys.map((k) => (
                <TableRow key={k.key_uuid}>
                  <TableCell sx={{ fontWeight: 600 }}>{k.label}</TableCell>
                  <TableCell><Typography fontFamily="monospace">{k.prefix}</Typography></TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={k.status}
                      color={k.status === 'active' ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell>{k.created_at ? new Date(k.created_at).toLocaleString() : '—'}</TableCell>
                  <TableCell>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}</TableCell>
                  <TableCell align="right">
                    {k.status === 'active' && (
                      <Tooltip title="Revoke">
                        <IconButton size="small" color="error" onClick={() => revoke(k)}>
                          <RevokeIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Mint dialog */}
      <Dialog open={mintOpen} onClose={() => setMintOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Generate API Key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Label"
            placeholder="e.g. student-apk"
            fullWidth
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          {mintErr && <Alert severity="error" sx={{ mt: 2 }}>{mintErr}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMintOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={mint} disabled={mintBusy}>
            {mintBusy ? 'Generating…' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Show-once dialog */}
      <Dialog open={!!newKey} onClose={() => setNewKey(null)} fullWidth maxWidth="sm">
        <DialogTitle>Key generated — copy it now</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This is the <strong>only</strong> time the raw key is shown. It cannot be retrieved again.
          </Alert>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography fontFamily="monospace" sx={{ flex: 1, wordBreak: 'break-all', fontSize: 13 }}>
              {newKey?.api_key}
            </Typography>
            <IconButton onClick={() => newKey && copy(newKey.api_key)}><CopyIcon /></IconButton>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Embed it when building the client: <code>--dart-define=API_KEY=…</code> (Flutter) or send it as the{' '}
            <code>X-Api-Key</code> header.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => { navigator.clipboard?.writeText(newKey?.api_key ?? ''); setFlash('Copied to clipboard'); }}>Copy &amp; Close</Button>
          <Button onClick={() => setNewKey(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
