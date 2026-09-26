// Shared bits for the browser suites that drive a real server.
//
// Since the passphrase gate went in, every one of them has to get through it
// first. Doing that by filling in the real form rather than by forging a
// cookie means the suites also keep the gate honest: if it stops accepting a
// correct passphrase, every one of them fails rather than quietly bypassing it.

const BASE = process.env.MW_BASE_URL || 'http://127.0.0.1:3940/';
const EXE  = process.env.MW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PASSPHRASE = process.env.APP_PASSPHRASE || '';

// Only this origin. The sandbox cannot reach fonts.googleapis.com and waiting
// for it to time out on every navigation costs more than the whole suite.
async function onlyThisOrigin(ctx){
  await ctx.route('**', r =>
    r.request().url().startsWith(BASE) ? r.continue() : r.abort());
}

/* Open the app in a fresh context, going through the gate if there is one. */
async function openApp(browser, { url = BASE, viewport = { width:1280, height:940 } } = {}){
  const ctx = await browser.newContext({ viewport });
  await onlyThisOrigin(ctx);
  const page = await ctx.newPage();
  await enter(page, url);
  return { ctx, page };
}

/* Go to a url, passing the gate on the way if it asks. */
async function enter(page, url){
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (await page.$('input[name="passphrase"]')){
    if (!PASSPHRASE){
      throw new Error('the server has a passphrase gate but APP_PASSPHRASE is not set ' +
                      'for the test run');
    }
    await page.fill('input[name="passphrase"]', PASSPHRASE);
    await Promise.all([
      page.waitForNavigation({ waitUntil:'domcontentloaded' }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);
    // The gate redirects to '/', so come back to where we were actually
    // going. Moving from '/' to '/#/f/key' is a hash-only change, which the
    // browser does not reload for — the page notices and reloads itself, so
    // this waits for that rather than racing it with a reload of its own.
    if (url !== BASE){
      await page.goto(url, { waitUntil:'domcontentloaded' });
      await page.waitForFunction(
        () => { try { return typeof store === 'string' &&
                             (!familyKeyFromUrl() || familyKeyFromUrl() === familyKey ||
                              store === 'stalled'); }
                catch (e) { return false; } }, null, { timeout: 20000 });
    }
  }
  return page;
}

/* SAY WHO IS VIEWING, if the page is asking.

   Since who-is-viewing moved onto the session, a family session that has not
   answered is given a roster and a question instead of a tree — every word the
   app produces is reckoned from one person, so a tree handed to nobody would
   be described to nobody. Every suite here signs in fresh, so every suite
   meets the question. Answering it with the first name on the list is what a
   relative does, and it is what makes the rest of each suite exercise a tree
   that is actually being read from somebody's side.

   Returns the name it answered with, or null if nothing was asked — a family
   with nobody in it yet has nobody to be, and goes straight through. */
async function sayWhoYouAre(page, { timeout = 6000 } = {}){
  const asked = await page.waitForSelector('#whoQ', { timeout }).catch(() => null);
  if (!asked) return null;
  const first = await page.$('#whoList [data-who]');
  if (!first) return null;
  const name = (await first.textContent()).trim();
  /* The click can lose its element: answering goes to the server and the
     panel is removed when it answers, so a suite that has ALREADY answered
     and then calls ready() finds the panel on its way out. That is the answer
     landing, not a failure — wait for it to be gone either way. */
  await first.click().catch(() => {});
  await page.waitForSelector('#whoQ', { state:'detached', timeout: 10000 });
  return name;
}

/* THROUGH THE DOOR.

   The app opens on a question now — who am I here, who am I looking for, or
   show me the tree — and the tree is behind it. That is the point of it: a
   relative who has never seen this should not have to read a diagram before
   they can do anything. But it means every suite that drives the TREE has to
   get past it first, the way a person does, by pressing the way that says
   "show me the tree".

   Pressed rather than hidden, deliberately. A suite that reached in and set
   `door.hidden` would go on passing on a day the button stopped working.

   Cheap and idempotent: where there is no door — an empty family, or one this
   suite has already walked through — it looks once and returns. */
async function throughDoor(page, { timeout = 4000 } = {}){
  const up = await page
    .waitForSelector('#door [data-door="tree"]', { timeout, state:'visible' })
    .catch(() => null);
  if (!up) return false;
  await up.click().catch(() => {});
  await page.waitForSelector('#door', { state:'hidden', timeout: 5000 }).catch(() => {});
  return true;
}

/* OPEN THE RECORD ON A CARD.

   A card answers first now — the Shona word, which side of the family, and
   the things there are to do — and everything that is a form is behind one
   fold named "More about <name>". A suite that drives the fields, the joins
   or the rare switches has to open it, the way a person does.

   Pressed rather than forced open, for the same reason throughDoor presses
   the door: a suite that set `details.open` by hand would go on passing on a
   day the fold stopped opening. */
async function openRecord(page, { timeout = 5000 } = {}){
  const fold = await page.$('#form [data-fold="record"]');
  if (!fold) return false;
  if (await fold.evaluate(d => d.open)) return true;
  await page.click('#form [data-fold="record"] > summary');
  await page.waitForFunction(
    () => { const d = document.querySelector('#form [data-fold="record"]'); return d && d.open; },
    null, { timeout });
  return true;
}

const ready = async page => {
  // Bounded short: most of the time nothing is asked and this is the cost of
  // finding that out.
  await sayWhoYouAre(page, { timeout: 3000 });
  await page.waitForFunction(
    () => { try { return store === 'shared' && !!treeId; } catch (e) { return false; } },
    null, { timeout: 20000 });
  // And past the front of the app, so what follows is driving the tree.
  await throughDoor(page, { timeout: 2500 });
  return page;
};

const settled = page => page.waitForFunction(
  () => { try { return typeof store === 'string'; } catch (e) { return false; } },
  null, { timeout: 20000 });

/* Waits until the server has everything.

   `settled` only says the page has decided WHERE it keeps things. It does not
   say anything has been sent, so a suite that writes and then reads back is
   racing its own save — and the race is invisible until an id changes under an
   open panel and the run fails once in five.

   This asks the page the only question that actually answers it: is there
   still a difference between what is on screen and what was last synced?

   AND IT ANSWERS THE ONE QUESTION THE SERVER INSISTS ON FIRST. A suite that
   plants a family and saves is, at that moment, the first person in a brand
   new family: the tree was empty when the page loaded, so nobody was asked
   who is looking, and the first name planted ends that. The save's own read
   comes back 428 and the page puts the question on screen and waits — which
   is correct, and it is what a person answers with one tap. Nothing here can
   finish until somebody does, so this is somebody. */
const saved = async (page, { timeout = 20000 } = {}) => {
  const until = Date.now() + timeout;
  for (;;) {
    if (await page.$('#whoQ')) await sayWhoYouAre(page, { timeout: 5000 });
    const done = await page.evaluate(() => {
      try {
        if (typeof store !== 'string') return false;
        if (store !== 'shared') return true;        // local: nothing to send
        return !sending && diffOps(synced, state).length === 0;
      } catch (e) { return false; }
    });
    if (done) return page;
    if (Date.now() > until) {
      throw new Error('saved(): the page still had unsent work after ' + timeout + 'ms');
    }
    await page.waitForTimeout(150);
  }
};

module.exports = { BASE, EXE, PASSPHRASE, openApp, enter, onlyThisOrigin,
                   ready, settled, saved, sayWhoYouAre, throughDoor, openRecord };
