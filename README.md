# Elan Scolaire — V1

Application web de suivi scolaire intelligent pour les mathématiques de 3e au Bénin.

## Ce que cette V1 fait

- landing page publique, `/demo`, `/activation`, `/bienvenue`, `/confidentialite`
- activation par clé côté serveur
- connexion parent/admin
- tableau de bord parent
- espace élève
- déclaration de progression
- upload de travaux avec stockage privé local de développement
- analyse d’accompagnement côté serveur
- préparation d’un devoir
- espace BEPC
- espace accompagnement premium
- administration avec génération de clés
- PWA minimale (`manifest.ts`)

## Mode actuel

Cette V1 tourne **fonctionnellement en local avec un stockage JSON sécurisé côté serveur** dans `data/dev-db.json`.

Pourquoi :

- vous avez fourni l’URL Supabase publique et la clé anonyme ;
- il manque encore la `SUPABASE_SERVICE_ROLE_KEY` pour piloter les opérations serveur sensibles et appliquer réellement les migrations à distance.

Le projet est donc :

- **fonctionnel localement immédiatement**
- **architecturé pour Supabase**
- livré avec une migration SQL de référence dans `supabase/migrations/001_init.sql`

## Installation

```bash
npm install
```

## Variables d’environnement

Copier `.env.example` vers `.env.local` puis renseigner :

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_PURCHASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` ou `GEMINI_API_KEY`
- `SUPPORT_GROUP_URL`
- `LICENSE_WEBHOOK_SECRET`

## Lancement local

```bash
npm run dev
```

Puis ouvrir :

- `/`
- `/demo`
- `/activation`
- `/connexion`
- `/admin`

## Génération de clés

1. se connecter sur `/admin`
2. choisir `1`, `10`, `50` ou `100`
3. cliquer sur “Générer des clés”
4. copier une nouvelle clé dans l’export affiché ou dans la source de données de développement explicitement activée

## Premier admin en production

En production Supabase, créer l’utilisateur normalement puis mettre son rôle à `admin` côté base de données / serveur. Ne jamais exposer de bouton public “devenir admin”.

## Tests

```bash
npm run test
npm run lint
npm run build
```

## Déploiement Vercel + Supabase

Avant production :

1. créer le projet Supabase
2. appliquer `supabase/migrations/001_init.sql`
3. configurer les buckets privés pour les copies
4. renseigner les variables Vercel
5. remplacer le stockage JSON local par les appels Supabase serveur

## Intégration achat

Le bouton d’achat lit `NEXT_PUBLIC_PURCHASE_URL`.

## Groupe d’accompagnement

Le bouton premium lit `SUPPORT_GROUP_URL`.

## Analyse IA

- `AI_PROVIDER=openai` recommandé en production
- `AI_PROVIDER=gemini` possible si configuré proprement côté serveur
- `AI_PROVIDER=mock` uniquement pour développement/test

## Points restant avant production

- brancher le repository serveur sur Supabase réel
- activer le vrai stockage privé Supabase Storage
- compléter la gestion fine des rôles Supabase Auth
- ajouter un vrai test E2E navigateur
