# Daybook

Your personal tracker: video edits (raw → cutting → graphics → review → exported), tasks,
learning time, new things to start, your daily routine with streaks, a focus timer and a journal.

- Works **offline**. Everything saves on the device first.
- **Installs** on Android from Chrome, so it gets its own icon and opens full-screen like an app.
- **Syncs** between your phone and PC once you connect a free Supabase project and sign in.

## 1. Put it online (needed so your phone can install it)

Android only installs web apps served over HTTPS. Free option: **GitHub Pages**.

1. Create a free account at github.com.
2. New repository → name it `daybook` → Public → Create.
3. "uploading an existing file" → drag in **everything in this folder** (including the `icons` folder) → Commit.
4. Settings → Pages → Branch: `main`, folder `/ (root)` → Save.
5. After about a minute your app is live at `https://<your-username>.github.io/daybook/`.

## 2. Install on your Android phone

1. Open that link in **Chrome** on the phone.
2. Tap ⋮ → **Install app** (or **Add to Home screen**), or open the gear in Daybook → **Install Daybook on this device**.
3. Daybook now sits on your home screen and opens like any other app.

## 3. Turn on sync (phone + PC)

1. Create a free account at supabase.com → **New project** (any name, pick a region near you, save the database password somewhere).
2. In the project: **SQL Editor** → New query → paste all of `supabase-setup.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: leave Email on. Turning **Confirm email** off
   lets you sign in straight away; with it on, you click a link in your inbox once.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
5. In Daybook: gear → Supabase connection → paste both → **Save connection**.
   (Or put them in `config.js` before uploading, so every device has them already.)
6. **Create account** with your email and a password. On your other device, open Daybook and **Sign in** with the same ones.

The dot next to the gear shows sync: green = synced, amber = syncing, red = a problem (open the gear to read it), grey = sync off.

## Updating the app

Change the files, bump `VERSION` in `sw.js` (e.g. `daybook-v2`), upload again. Phones pick up the new
version the next time the app is opened with a connection.

## Backup

Gear → **Export backup** saves a `.json` file of everything; **Import backup** merges one back in.
