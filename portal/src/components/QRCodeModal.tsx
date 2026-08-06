// src/components/QRCodeModal.tsx
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
  Box,
} from '@mui/material';
import { Close as CloseIcon, QrCode as QRCodeIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  sessionCode: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function QRCodeModal({
  open,
  onClose,
  token,
  sessionCode,
  refreshing,
  onRefresh,
}: QRCodeModalProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          <QRCodeIcon sx={{ mr: 1 }} />
          Session QR Code
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
          <Typography variant="h6" gutterBottom>Session: {sessionCode}</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Scan this QR code to mark attendance
          </Typography>
          
          <Box sx={{ mt: 2, p: 3, bgcolor: 'grey.50', borderRadius: 2, textAlign: 'center', minWidth: 280 }}>
            <Typography variant="h2" fontFamily="monospace" fontWeight={700} letterSpacing="0.3em" color="primary.main">
              {token}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Refreshes every 3 seconds
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={refreshing}
            sx={{ mt: 2 }}
          >
            Refresh Token
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}