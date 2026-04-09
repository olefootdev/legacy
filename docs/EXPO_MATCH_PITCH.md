# Expo + WebView + pitch HTTP (dev)

## Android e HTTP local

`app.json` define `android.usesCleartextTraffic: true` para permitir `http://` **apenas em desenvolvimento**. Para builds de loja, use viewer em **HTTPS** e remova ou condicione cleartext via perfil de build (EAS).

## URLs por plataforma

| Ambiente | URL base do viewer |
|----------|---------------------|
| iOS Simulator | `http://localhost:5174` |
| Android Emulator | `http://10.0.2.2:5174` |
| Dispositivo físico | `http://<IP-LAN-da-máquina>:5174` via `EXPO_PUBLIC_PITCH_URL` |

Exemplo (`.env` no app Expo):

```bash
EXPO_PUBLIC_PITCH_URL=http://192.168.1.42:5174
```

Reinicie o bundler do Expo após alterar variáveis.

## Dois terminais

1. Viewer: `cd web/match-pitch && npm run dev`
2. Expo: `cd mobile && npm start` (e `i` / `a` conforme a plataforma)
