
## Backend conectado al frontend

Variables mínimas para desarrollo:

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/mundial2026
CLIENT_URL=http://localhost:4321
CORS_ORIGIN=http://localhost:4321
SESSION_SECRET=cambia_este_valor
```

Google OAuth quedó opcional en local. Si no defines `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, el backend arranca igual y solo `/auth/google` queda deshabilitado.

