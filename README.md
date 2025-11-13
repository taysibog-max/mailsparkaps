## Automailer

Jednostavna web aplikacija za slanje emailova preko SMTP-a.

### Pokretanje

1. Instalirajte dependencies:

```bash
npm install
```

2. Napravite `.env` na osnovu `.env.example` i popunite SMTP podatke.

3. Pokrenite razvojni server:

```bash
npm run dev
```

Server: `http://localhost:3000`

### API

`POST /api/send`

Body (JSON):

```json
{ "to": "user@example.com", "subject": "Naslov", "text": "Poruka", "html": "<strong>Poruka</strong>" }
```

Odgovor:

```json
{ "ok": true, "messageId": "<...>" }
```


