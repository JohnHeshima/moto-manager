## Architecture

Le projet est maintenant separé en trois couches sous `src/` :

```text
src/
  app/                    # routes Next.js
  frontend/
    components/           # UI, vues, widgets
    contexts/             # etat et providers React
  backend/
    firebase/             # config Firebase
    services/             # acces Firestore / Storage
  shared/
    lib/                  # utilitaires et logique partagee
    types/                # types metier
```

## Demarrage

Lancer le serveur de developpement :

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Ouvrir `http://localhost:3000`.

## Regles de separation

- `src/app` et `src/frontend` ne contiennent que du code d'interface.
- `src/backend` contient l'acces Firebase et les services de donnees.
- `src/shared` contient les types et la logique reutilisable par les deux couches.
